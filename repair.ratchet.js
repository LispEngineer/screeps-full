// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// This module tracks the minimum repair level of walls and ramparts,
// and increases it periodically so that we constantly but slowly upgrade
// all our ramparts and walls.
//
// If there is no ratchet set, it sets the ratchet to a base level
// with a minimum and maximum (e.g., 50,000 to start or 125,000 max).
// It only does this for rooms that we own the controller for.
//
// Every so many ticks it pulls the minimum repair level of ramparts and walls.
// If it's all at least the ratchet level, and we haven't ratcheted it up
// in the last N ticks, then we ratchet it up another delta amount.
//
// If we don't own a room anymore, we clear the ratchet for that room.
//
// The ratchets can be linked. So, don't ratchet one
// thing up without ratcheting the others (e.g., ramparts/walls),
// or at least leave them within one delta of each other.
//
// TODO: 

"use strict";
const resources = require('resources');
const stats = require('screepsplus');
const flags = require('flag');

// We check for ratchets every this many ticks (TODO: 10)
const CHECK_INTERVAL = 100;

// We ratchet up, potentially, every this many ticks since last ratchet up (TODO: 30?)
const RATCHET_INTERVAL = 500;

// What we round our ratchets down to
const RATCHET_ROUND = 1000;

// What key we store our info in memory
const BASE_MEMORY_LOCATION = "rep_ratch";

// What structures we ratchet up.
// TODO: Remove this and use Object.keys() on RATCHET_AMOUNTS
const RATCHET_STRUCTURES = [STRUCTURE_RAMPART, STRUCTURE_WALL];

// Min/max ratchet for new rooms
// delta = how high we go up each time we ratchet things up
// linked = other structures that we try to keep our ratchet within delta of
// min = what we start out for ratchet
// max = what we cap out at, unless overridden by
// room_max = per-room maximums
const RATCHET_AMOUNTS = {
    [STRUCTURE_RAMPART]: {
        min: 50000,
        max: 150000,
        room_max: {
            W56S31: 550000,
            W55S31: 550000,
            W54S31: 440000,
        },
        delta: 20000,
        linked: [STRUCTURE_WALL],
    },
    [STRUCTURE_WALL]: {
        min: 50000,
        max: 150000,
        room_max: {
            W56S31: 550000,
            W55S31: 550000,
            W54S31: 440000,
        },
        delta: 20000,
        linked: [STRUCTURE_RAMPART],
        // For our flag overrides, use this structure type
        flag_struct: STRUCTURE_RAMPART,
    },
}; // RATCHET_AMOUNTS


// STATS CALLBACKS ////////////////////////////////////////////////////////////

function add_ratchet_stats(s) {
    // console.log('add_ratchet_stats');
    // console.log(JSON.stringify(s));
    
    for (const room_name of Object.keys(s.roomSummary)) {
        // console.log(room_name);
        const ratch = {};
        s.roomSummary[room_name].ratchet = ratch;
        
        ratch.last_tick = get_last_ratchet_tick(room_name);
        
        for (const struct of RATCHET_STRUCTURES) {
            // console.log('Checking ratchet of', struct, 'in', room.name);
            const rcurrent = get_ratchet(room_name, struct);
            
            ratch[struct] = {
                current: rcurrent,
                delta: RATCHET_AMOUNTS[struct].delta,
            };
        } // All structures
    } // All rooms
} // add_ratchet_stats

stats.add_stats_callback(add_ratchet_stats);


// MEMORY /////////////////////////////////////////////////////////////////////

// Memory locations for use with LoDash get/set
function mem_loc_ratchet(room_name, structureType) {
    return [BASE_MEMORY_LOCATION, room_name, structureType]
}

// Memory locations for use with LoDash get/set
function mem_loc_ratchet_tick(room_name, structureType) {
    return [BASE_MEMORY_LOCATION, 'last_ratchet_tick']
}

// How much will we ratchet this structure up by?
// 0 if we're not ratcheting it.
function get_ratchet_delta(room, structureType) {
    return _.get(RATCHET_AMOUNTS, [structureType, 'delta'], 0);
}

// Returns the current ratchet setting for this room,
// or 0 if it is not set.
// room - a Room object (preferably) or room name.
function get_ratchet(room, structureType) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    return _.get(Memory, mem_loc_ratchet(room.name, structureType), 0);
} // get_ratchet

function set_ratchet(room, structureType, value) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    _.set(Memory, mem_loc_ratchet(room.name, structureType), value);
} // set_ratchet

// Gets the last tick we upped the ratchet. If not set, returns 0.
function get_last_ratchet_tick(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    return _.get(Memory, mem_loc_ratchet_tick(room.name), 0);
} // get_last_ratchet_tick

// Sets the ratchet tick for this room to now
function set_last_ratchet_tick(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    _.set(Memory, mem_loc_ratchet_tick(room.name), Game.time);
} // set_last_ratchet_tick

// Removes any information about this room's ratchet
function clear_ratchet(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    delete Memory[BASE_MEMORY_LOCATION][room.name];
} // clear_ratchet


// RATCHETING //////////////////////////////////////////////////////////////


function get_max_ratchet(room, struct) {
    // Check for a flag
    const flag_struct_override = RATCHET_AMOUNTS[struct].flag_struct;
    const flag_struct = flag_struct_override ? flag_struct_override : struct;
    const flag_setting = flags.get_ratchet_struct(room.name, flag_struct);

    if (flag_setting) {
        console.log(room.name, struct, 'ratchet flagged to max', flag_setting);
        return flag_setting;
    }

    return _.get(RATCHET_AMOUNTS, [struct, 'room_max', room.name],
                 RATCHET_AMOUNTS[struct].max);
}

// Call this every tick to see if we need to ratchet things up.
function check_repair_ratchets() {
    if ((Game.time % CHECK_INTERVAL) != 0) {
        // Don't check this tick
        return;
    }
    
    for (const room_name in Game.rooms) {
        const room = Game.rooms[room_name];
        
        if (room.controller == null || !room.controller.my) {
            // No repair ratchet for this room since we don't own it
            // console.log('Not ratcheting repair for unowned room', room.name);
            continue;
        }
        
        const last_ratchet = get_last_ratchet_tick(room);
        if (Game.time < last_ratchet + RATCHET_INTERVAL) {
            // console.log('Not ratcheting room due to recent ratchet', room.name);
            continue;
        }
        
        const ri = resources.summarize_room(room);
        
        // TODO: Only ratchet one of wall/rampart until they're equal, then start
        // ratcheting them together.
        
        next_struct: for (const struct of RATCHET_STRUCTURES) {
            // console.log('Checking ratchet of', struct, 'in', room.name);
            const rcurrent = get_ratchet(room, struct);
            const rmax = get_max_ratchet(room, struct);
            let rnew = rcurrent;

            if (rcurrent == 0) {
                // Initialize our current ratchet
                rnew = _.get(ri.structure_info[struct], ['min_hits'], 0);
                if (rnew < RATCHET_AMOUNTS[struct].min) {
                    rnew = RATCHET_AMOUNTS[struct].min;
                }
                console.log('Initial ratchet for room', room.name, struct, 'is', rnew);
            } else if (rcurrent >= rmax) {
                console.log('Not ratcheting room', room.name, struct, 'due to hitting max', rmax);
                continue;
            } else {
                // Check if we should increase our ratchet
                let cmin = _.get(ri.structure_info[struct], ['min_hits'], 0);
                if (cmin < rcurrent) {
                    // console.log('Not ratcheting', room.name, struct, 'due to min', cmin, 'lower than current ratchet', rcurrent);
                    continue;
                }
                
                // We could ratchet up since we're fully repaired.
                
                // Check if there are any linked ratchets - we only ratchet up the lowest of a linked ratchet.
                const links = RATCHET_AMOUNTS[struct].linked;
                
                if (links != null && links.length > 0) {
                    // Check that our current ratchet is lower (or equal) than all our linked ratchets;
                    // if not, let's ratchet that other one first.
                    for (const lstruct of links) {
                        const lr = get_ratchet(room, lstruct);
                        if (lr <= 0) {
                            // This isn't currently ratcheted, so ignore
                            continue; // to the next linked structure
                        }
                        if (lr < rcurrent) {
                            // console.log('Not ratcheting', room.name, struct, 'due to linked', lstruct, 'having a lower ratchet (',
                            //             rcurrent, 'vs', lr, ')');
                            continue next_struct;       
                        }
                    } // all linked structure types
                } // linked ratchet check
                
                rnew = rcurrent + RATCHET_AMOUNTS[struct].delta;
                console.log('Ratcheting', room.name, struct, 'from', rcurrent, 'to', rnew);
            } // Initial ratchet or not?
            
            rnew = Math.floor(rnew / RATCHET_ROUND) * RATCHET_ROUND;
            set_ratchet(room, struct, rnew);
            set_last_ratchet_tick(room);
            
        } // all structures
    } // all rooms
} // check_repair_ratchets()



module.exports = {
    
    check_repair_ratchets,
    get_ratchet_delta,

    // Access for debugging
    get_ratchet,
    set_ratchet,
    get_last_ratchet_tick,
    set_last_ratchet_tick,
    get_max_ratchet,
    clear_ratchet,

};
