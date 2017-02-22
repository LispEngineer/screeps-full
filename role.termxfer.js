// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// This creep moves non-energy resources from all storage containers to terminals,
// until they are 90% full.

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');
const flag = require('flag');

const SOURCE_STRUCTURES = [STRUCTURE_CONTAINER, STRUCTURE_STORAGE];
const REVERSE_SOURCE_STRUCTURES = [STRUCTURE_STORAGE];
const DEST_STRUCTURES = [STRUCTURE_TERMINAL];

// TODO: Make a flag that means "reverse the meaning of termxfer in this room"
const FLAG_COLOR_REVERSE = COLOR_ORANGE;
const FLAG_SEC_REVERSE = COLOR_PURPLE;

// What to do when we're harvesting
// Get energy from the fullest container.
// TODO: Get >100 energy from the ground unless there are containers
// that are "almost full" (above 75%)?
function do_harvest(creep) {
    
    let sources = SOURCE_STRUCTURES;
    
    if (creep.memory.reverse) {
        sources = DEST_STRUCTURES;
    }

    if (!c.load_resource(creep, sources)) {
        let load = false;
        if (creep.memory.reverse) {
            load = c.reload_energy(creep, sources, true);
        }
        // TODO: Count the number of failures and switch to acting
        if (!load) { 
            c.move_to_closest(creep, sources);
        }
    }
} // do_harvest

// What to do when we're acting
function do_act(creep) {
    
    let dests = DEST_STRUCTURES;
    if (creep.memory.reverse) {
        dests = REVERSE_SOURCE_STRUCTURES;
    }
    c.deliver_structure(creep, dests, null);
} // do_act


function run(creep) {
    const death_imminent = 40;
    if (creep.ticksToLive <= death_imminent) {
        // Always do a final transfer at the end before we die
        if (creep.ticksToLive == death_imminent) {
            console.log(creep.name + ' is about to die...');
        }
        const dests = creep.memory.reverse ? REVERSE_SOURCE_STRUCTURES : DEST_STRUCTURES;
        c.dump_and_despawn(creep, dests);
        return;
    }

    // TODO: If no storage has any non-energy resources, give up and
    // despawn

    // Keep trying to load resources, or give up after N ticks without
    // them, and deliver.
    if (creep.memory.reverse == null) {
        // Check for a flag
        const fr = flag.get_flag_rooms(FLAG_COLOR_REVERSE, FLAG_SEC_REVERSE);
        creep.memory.reverse = fr.includes(creep.room.name);
        console.log(creep.name, 'termxfer, reverse:', creep.memory.reverse);
    }

    c.harvest_or_act(creep, do_harvest, do_act, null, null);
} //  do_run


// Get as many CARRY, CARRY, MOVE as we can fit
// within our energy capacity.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const groupCost = 150;
    const group = [CARRY, CARRY, MOVE];
    const maxGroups = 4;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    return retval;
} // spawn_body



// How many of these guys are desired in the specified room?
// None, except by override.
function num_desired(room) {
    return 0;
}


module.exports = {
    run,
    spawn_body,
    num_desired,
};
