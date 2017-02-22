// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Handles organizing our repairs, etc.

"use strict";
const util = require('util');
const flg = require('flag');
const rr = require('repair.ratchet');

// Do not repair flags
const FLAG_COLOR_DNR = COLOR_RED;
const FLAG_SEC_DNR = COLOR_BROWN;

/** An array of structure types. If the structure types are to be in the same
 * repair priority, then they should be another embedded array.
 * @type {(string|string[])[]}
 */
const REPAIR_PRIORITY = [
    STRUCTURE_SPAWN,
    STRUCTURE_TOWER,
    STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL,
    STRUCTURE_LAB,
    STRUCTURE_EXTRACTOR,
    STRUCTURE_EXTENSION,
    STRUCTURE_LINK,
    STRUCTURE_CONTAINER,
    STRUCTURE_ROAD,
    [STRUCTURE_RAMPART, STRUCTURE_WALL],
];

/** How we know when to start/stop repairing something. Only one of the
 * `*_pct` or `*_amt` pairs is allowed.
 * @typedef {Object} RepairLimits
 * @property {?number} start_rep_pct - When to start repairing as a pecentage of hits
 * @property {?number} end_rep_pct   - When to start repairing as a pecentage of hits
 * @property {?number} start_rep_amt - When to start repairing as absolute # of hits
 * @property {?number} end_rep_amt   - When to start repairing as absolute # of hits
 * @property {?boolean} dnr - Should we check the do-not-repair flag list?
 */

/** An objects whose keys are `STRUCTURE_*` and whose values are `RepairLimits`,
 * specifying how much to repair each type of `STRUCTURE_*`
 *
 * @type {Object.<string,RepairLimits>}
 */
const REPAIR_DETAILS = {
    [STRUCTURE_SPAWN]:     { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_TOWER]:     { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_STORAGE]:   { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_TERMINAL]:  { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_LAB]:       { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_EXTRACTOR]: { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_EXTENSION]: { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_LINK]:      { start_rep_pct: 0.95, end_rep_pct: 1.00 },
    [STRUCTURE_CONTAINER]: { start_rep_pct: 0.66, end_rep_pct: 0.95 },
    [STRUCTURE_ROAD]:      { start_rep_pct: 0.66, end_rep_pct: 0.95, dnr: true },
    [STRUCTURE_RAMPART]:   { start_rep_amt: 250000, end_rep_amt: 280000, dnr: true },
    [STRUCTURE_WALL]:      { start_rep_amt: 250000, end_rep_amt: 280000, dnr: true },
};
global.repair_order = [];
global.repair_details = REPAIR_DETAILS;
global.repair_priority = REPAIR_PRIORITY;


// Asks if we should not repair something at the specified position in the specified room.
// Input is a RoomPosition object
function should_not_repair(room_pos) {
    const dnr_locs = flg.get_flag_poses(FLAG_COLOR_DNR, FLAG_SEC_DNR);
    return dnr_locs.includes(room_pos);
}


// Gets the currently configured repair details for this
// structure in this room. If the structure has a ratchet,
// it returns the current ratchet information for this room,
// otherwise returns the data in REPAIR_DETAILS.
function get_repair_details(struct, room) {
    if (REPAIR_DETAILS[struct] == null) {
        return null;
    }
    const ratchet = rr.get_ratchet(room, struct);
    if (ratchet <= 0) {
        return REPAIR_DETAILS[struct];
    }
    let retval = _.clone(REPAIR_DETAILS[struct]);
    retval.start_rep_amt = ratchet;
    retval.end_rep_amt = ratchet + rr.get_ratchet_delta(room, struct);
    return retval;
}

// Orders structures by increasing percentage of hits
function incr_pct_hits(a, b) {
    return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
}
/** Orders structures by increasing hits */
function incr_hits(a, b) {
    return a.hits - b.hits;
}

// Returns a list of all structures ordered by their repair priority
function prioritize_for_repair() {
    // Importance of repairs:
    // CONTAINERS
    // ROADS
    // WALLS
    // RAMPARTS

    // Find all the rooms that I have structures in all rooms and put into a gigantic list
    let structs = util.all_structures();
    // console.log(JSON.stringify(structs.map(s => s.structureType + ' ' + s.pos + ' ' + s.hits + ' ' + s.hitsMax)));
    // Structures in order that we want to repair
    let repord = [];
    // let scanmsg = "";

    let start_rep, end_rep, pct, repairing_now, dnr;

    if (Memory.repairs == null) {
        Memory.repairs = {};
    }

    // For every structure type we're repairing...
    for (let st of REPAIR_PRIORITY) {
        
        // let rd = global.dpf_rep.details[st];
        
        // Find all structures of this type
        let ss;
        // console.log(st, JSON.stringify(ss.map(s => s.structureType + ' ' + s.pos + ' ' + s.hits + ' ' + s.hitsMax)));
        let nr = [];
        let repcnt = 0;

        // Filter based upon the structure type being an array or not
        if (_.isArray(st)) {
            ss = _.filter(structs, s => st.includes(s.structureType) && s.hitsMax > 0);
            // console.log('ARRAY', JSON.stringify(st));
            // console.log('ARRAY REPAIR ITEMS', JSON.stringify(ss.map(s => _.pick(s,'structureType'))));
        } else {
            ss = _.filter(structs, s => st == s.structureType && s.hitsMax > 0);
        }

        // Loop through them all and:
        // 1. If the health is too low, add it to the "repair" list
        // 2. Set the structure's "needs_repair" variable based upon its health
        for (const s of ss) {
            
            // Get the room-specific repair details
            let rd = get_repair_details(s.structureType, s.room);

            // If we're not repairing this location, skip it
            start_rep = end_rep = false;
            dnr = false;
            if (rd.dnr) {
                if (should_not_repair(s.pos)) {
                    console.log('Not repairing structure', s.structureType, s.pos);
                    dnr = true;
                    start_rep = false;
                    end_rep = true;
                }
            }

            if (!dnr) {
                if (rd.start_rep_pct == null) {
                    // Do our repairs based upon absolute amounts
                    if (s.hits <= rd.start_rep_amt) {
                        start_rep = true;
                    } else if (s.hits >= rd.end_rep_amt) {
                        end_rep = true;
                    }
                } else {
                    // Do our repairs based upon percentages
                    pct = s.hits / s.hitsMax;
                    if (pct <= rd.start_rep_pct) {
                        start_rep = true;
                    } else if (pct >= rd.end_rep_pct) {
                        end_rep = true;
                    }
                }
            }

            // Now we know whether we need to start or end
            // repairs, and we need to check its current repairing state
            if (Memory.repairs[s.id] == null) {
                Memory.repairs[s.id] = {};
            }
            repairing_now = Memory.repairs[s.id].needs_repair;
            if (repairing_now == null) {
                repairing_now = false;
            }

            if (start_rep) {
                repairing_now = true;
            } else if (end_rep) {
                repairing_now = false;
            }

            Memory.repairs[s.id].needs_repair = repairing_now;

            // If we need to repair it, add to our list for prioritization later
            if (repairing_now) {
                repcnt++;
                nr.push(s);
            }
        } // All structures of a given type

        // Order the structures of the given type by hits
        // if (st == STRUCTURE_ROAD) { console.log('pre', JSON.stringify(nr.map(r => r.hits / r.hitsMax))); }
        // We sort by absolute number for linked things, or percentages for others.
        // This is because if we are repairing walls and ramparts together, those
        // generally have different hitsMax.
        if (_.isArray(st)) {
            nr.sort(incr_hits);
        } else {
            nr.sort(incr_pct_hits); // Does an in-place sort
        }
        // if (st == STRUCTURE_ROAD) { console.log('post', JSON.stringify(nr.map(r => r.hits / r.hitsMax))); }
        repord = repord.concat(nr);
        // if (_.isArray(st)) { console.log(JSON.stringify(nr.map(r => r.structureType + ':' + r.hits + '/' + r.hitsMax))); }

        // scanmsg += st + ": " + repcnt + "/" + ss.length + ", ";
    }

    // And publish our repair ordering.
    global.repair_order = repord;

    // let msg = "Structures to repair. " + scanmsg + "\n";
    // for (let s of repord) {
    //     msg = msg + "\t" + s.structureType + " @ " + s.pos + ": " +
    //                 (s.hits / s.hitsMax * 100.0).toFixed(2) + "\n";
    // }
    // console.log(msg);
} // prioritize_for_repair

// Gets the higest priority STRUCTURE (not structure ID)
// that needs a repair that is not being repaired.
// Null if we've got nothing.
function get_next_repair(room_name) {
    if (global.repair_order == null || global.repair_order.length == 0) {
        // Array wasn't set up?
        return null;
    }
    for (const s of global.repair_order) {
        // Only find things in the specified room
        if (s.room.name != room_name) {
            continue;
        }
        if (repairer(s.id) != null) {
            // Already being repaired
            continue;
        }
        return s;
    }
    return null;
} // get_next_repair


// FIXME: Make these methods work for IDs/Names OR objects themselves

// Sees if the structure named by this ID needs repair
function needs_repair(s_id) {
    let mem = Memory.repairs[s_id];
    let retval;

    if (mem == null) {
        return false;
    }
    retval = mem.needs_repair;
    if (retval == null) {
        return false;
    }
    return retval;
} // needs_repair

// Returns the repairer of the structure ID
// (creep name) or null if none
function repairer(s_id) {
    let mem = Memory.repairs[s_id];
    let retval;

    if (mem == null) {
        return null;
    }
    retval = mem.repairer;
    if (retval == null) {
        return null;
    }
    return retval;
} // repairer

// Sets the repairer of the structure ID to the specified creep name..
// THAT IS ALL, doesn't set the repairing of the creep name.
// Returns the old value.
function set_repairer(s_id, cname) {
    let mem = Memory.repairs[s_id];
    let retval;

    if (mem == null) {
        console.log(new Error().stack);
        console.log('Memory for structure ID repairs is null: ' + s_id);
        return null;
    }
    retval = mem.repairer;
    mem.repairer = cname;
    return retval;
} // set_repairer

// Returns the ID of the structure this creep is
// repairing
function repairing(creep) {
    return creep.memory.repairing;
} // repairing

// Sets the ID of what this creep is repairing,
// as well as the fact that that structure is
// now being repaired by that creep (and the
// old structure isn't).
// Returns the old value
function set_repairing(creep, s_id) {
    let retval = creep.memory.repairing;
    creep.memory.repairing = s_id;
    if (s_id != null) {
        set_repairer(s_id, creep.name);
    }
    if (retval != null) {
        set_repairer(retval, null);
    }
    return retval;
} // set_repairing


// Handles what to do when a creep dies
// only for the repair module.
// We mark whatever it was repairing as free
// for someone else to repair, if anything.
function creep_died(cname) {
    // We can't use repairing, because we don't have a creep, just a name,
    // and can't get a Creep object cause it's dead!
    let crepairing = Memory.creeps[cname].repairing;
    if (crepairing == null) {
        // Not repairing anything, so we're done
        return;
    }
    console.log('Dead creep ' + cname + ' no longer repairing structure ID ' + crepairing);
    // He's no longer repairing cause he's dead!
    set_repairer(crepairing, null);
} // creep_died


// Cross-checks for memory corruption.
// All creeps who are repairing things have
// structures that think they're being repaired
// by that creep, and vice versa.
// Run this like every 100 ticks, just in case.
function cross_check_memory() {
    let cname, s_id, repr, msg;

    // Check all creeps that are repairing things
    for (cname in Memory.creeps) {
        s_id = Memory.creeps[cname].repairing;
        if (s_id == null) {
            // Not repairing anything
            continue;
        }
        repr = repairer(s_id);
        if (repr != cname) {
            msg = 'Warning: creep ' + cname + ' thinks it\'s repairing structure ID ' + s_id +
                  ' which thinks it\'s being repaired by ' + repr + '.';
            Game.notify(msg, 30);
            console.log(msg);
            // TODO: Clear it all?
            // Memory.creeps[name].repairing = null;
            // set_repairer(s_id, null);
        }
    }

    // Check that everything being repaired is being repaired by that creep
    for (s_id in Memory.repairs) {
        cname = repairer(s_id);
        if (cname == null) {
            // Not being repaired
            continue;
        }
        repr = Memory.creeps[cname].repairing;
        if (repr != s_id) {
            msg = 'Warning: Structure ID ' + s_id + ' thinks it\'s being repaired by creep ' + cname +
                  ' which thinks it\'s repairing structure ID ' + repr + '.';
            Game.notify(msg, 30);
            console.log(msg);
        }
    }

    // Check that all objects are in the repair memory are still valid
    for (s_id in Memory.repairs) {
        const obj = Game.getObjectById(s_id);
        if (obj == null) {
            console.log('Removing non-existent object ' + s_id + ' from Memory.repairs');
            delete Memory.repairs[s_id];
        }
    }
} // cross_check_memory


// Performs all necessary start-of-tick initialization
// 1. Set up the repair details in the global object
// 2. Enumerate all structures in all owned rooms in order of repair priority
// 3. Determine the repair order
function init() {
    // We do this only every three ticks now to save CPU
    if ((Game.time % 3) == 1 || Memory.repairs == null) {
        prioritize_for_repair();
    }
}

module.exports = {
    init,

    // Memory manipulation functions
    needs_repair,
    repairer,
    set_repairer,
    repairing,
    set_repairing,
    cross_check_memory,

    // Repair selection
    get_next_repair,
    should_not_repair,

    // Creep death reporting
    creep_died,
};
