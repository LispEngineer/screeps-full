// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// This creep just moves stuff from containers to extensions, spawn, and storage.
// It probably doesn't need any WORK modules.

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');

// TODO: Rename this to transferrer

// TODO: Check if all containers are empty and we are more than X%
// full, switch to acting regardless.

// TODO: Have the creeps check if there is stuff on the ground at the
// container location and take that first.


// What to do when we're harvesting
// Get energy from the fullest container.
// TODO: Get >100 energy from the ground unless there are containers
// that are "almost full" (above 75%)?
function do_harvest(creep) {
    const structureTypes = [STRUCTURE_CONTAINER];

    c.pickup_adjacent(creep);

    if (!c.reload_energy(creep, structureTypes, true)) {
        c.move_to_closest(creep, structureTypes);
    }
} // do_harvest

// What to do when we're acting
function do_act(creep) {
    c.pickup_adjacent(creep);
    c.deliver_structure(creep, [STRUCTURE_STORAGE], null);
} // do_act


function run(creep) {
    const death_imminent = 40;
    if (creep.ticksToLive <= death_imminent) {
        // Always do a final transfer at the end before we die
        if (creep.ticksToLive == death_imminent) {
            console.log(creep.name + ' is about to die...');
        }
        c.dump_and_despawn(creep);
        return;
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
    const maxGroups = 6;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    return retval;
} // spawn_body



// How many of these guys are desired in the specified room?
// 1. One, if we have storage
// 2. Otherwise zero
function num_desired(room) {
    const ri = resources.summarize_room(room);
    const num_storage = _.get(ri, ['structure_info', STRUCTURE_STORAGE, 'count'], 0);
    // console.log(room.name + ' storages ' + num_storage);

    if (num_storage <= 0) {
        return 0;
    }
    if (room.storage && !room.storage.my) {
        // Ignore rooms with someone else's storage (that we took over)
        return 0;
    }

    return 1;
}


module.exports = {
    run,
    spawn_body,
    num_desired,
};
