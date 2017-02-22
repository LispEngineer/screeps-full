// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Remote repairer
//
// Goes to the specified room when repairing.
// Goes back to the specified room to refill.

"use strict";
const c = require('creep');
const repair = require('repair');
const repairer = require('role.repairer2');
const resources = require('resources');

const ROOM_TO_REPAIR = 'W55S32'; // 'W54S31';
const ROOM_TO_REFILL = 'W55S31';


function run(creep) {

    creep.memory.multi_room = true;

    let go_to_room = null;

    // Get to the correct room.
    // console.log(creep.name, 'acting', creep.memory.acting, 'room', creep.room.name);
    if (creep.memory.acting && creep.room.name != ROOM_TO_REPAIR) {
        // console.log(creep.name, "moving to room to repair:", ROOM_TO_REPAIR);
        go_to_room = ROOM_TO_REPAIR;
    } else if (!creep.memory.acting && creep.room.name != ROOM_TO_REFILL) {
        // console.log(creep.name, "moving to room to refill:", ROOM_TO_REFILL);
        go_to_room = ROOM_TO_REFILL;
    }
    if (go_to_room) {
        c.move_to_room_safe(creep, go_to_room);
        let repairing = repair.repairing(creep);
        if (repairing) {
            repair.set_repairing(creep, null);
            repair.set_repairer(repairing, null);
        }
        return;
    }

    // Once in the correct room, do our thing.
    // console.log(creep.name, "in correct room to repair:", creep.room);

    // If there's something to build, do that first.
    // However, note that the repairer.run is what sends us back for more energy
    // when we run out.
    const built = c.build(creep);

    // console.log(creep.name, 'built?', built);

    if (!built) {
        repairer.run(creep);
    }
} // run


// Get as many WORK, CARRY, MOVE as we can fit
// within our energy capacity.
// NOTE: Make this sensitive to the available energy reserves in storage,
// and make smaller ones when we have low reserves.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const groupCost = 350;
    const group = [CARRY, CARRY, MOVE, CARRY, WORK, MOVE];
    const maxGroups = 1000;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    // console.log('rmrepair body ' + retval + ", numgroups: " + numGroups);
    return retval;
} // spawn_body


module.exports = {
    run,
    spawn_body,
};
