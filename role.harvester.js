// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');

// Harvester priorities:
// 1. Load up its carry capacity
// 2. Deliver it to a spawn, extension or tower, or container/storage
// 3. Otherwise deliver it to Room Controller

// TODO: Ensure that creeps spread themselves between all available
// sources equally, if possible. The "id" method doesn't seem to
// be working very well.
//
// One idea: Assign each creep a preferred source at spawn time,
// based upon counting the preferred source for each source in
// the room, and giving it to the one with the least.
// As a further optimization, calculate the number of spots
// adjacent to the source and balance based upon that.

// TODO: Only transfer to TOWER if the tower is less than
// 90% full. Or, let towers have memory that says if they
// need energy and we can check that. Every tick they can
// set their energy needed memory at the beginning. This
// way they could set it at below 90% and reset it above
// 98% (or whatever).


// What to do when we're harvesting
// As a harvester of last resort, we should always
// try to get stuff out of containers in case it's there.
// from a HARVESTER2.
function harvester_harvest(creep) {
    // First, get stuff from the ground.
    if (c.pickup_ground_energy(creep)) {
        return;
    }
    c.clear_ground_energy_memory(creep);

    if (c.load_hostile_energy(creep)) {
        return;
    }
    
    if (!c.reload_energy(creep, [STRUCTURE_CONTAINER], true, null, creep.carryCapacity / 4)) {
        if (!c.harvest(creep)) {
            // Nothing to harvest
            if (creep.carry.energy > 0) {
                console.log('Creep ' + creep.name + ': nothing to harvest. Acting.');
                creep.memory.acting = true;
            }
        }
    }
} // harvester_harvest


// What to do when we're acting
// As a harvester of last resort, we don't ever upgrade.
function harvester_act(creep) {
    c.deliver_structure(creep, [STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_TOWER], RESOURCE_ENERGY) ||
        // TODO: Stick it back into our container?
        c.deliver_storage_energy(creep, [STRUCTURE_STORAGE]) ||
        // Don't just let it go to waste...
        c.build(creep, true) || // Build closest thing
        c.upgrade_room_controller(creep);
} // harvest_act


function harvester_action_run(creep) {
    c.harvest_or_act(creep, harvester_harvest, harvester_act, null, null);
    c.pickup_adjacent(creep);
} //  harvester_action_run



function spawn_body(room) {
    return [CARRY, WORK, MOVE];
}

// How many of these guys are desired in the specified room?
// 1. Zero if are at controller level 3 or more
// 2. Otherwise 1 at 2, 2 at 1, and 3 at 0 (not that we will
//    be at 0 long enough to build three)
function num_desired(room) {
    const ri = resources.summarize_room(room);

    if (ri.controller_level >= 3) {
        return 0;
    }
    return ri.num_sources;
}



module.exports = {
    run: harvester_action_run,
    spawn_body,
    num_desired,
    
    // Sharing
    harvester_harvest,
};
