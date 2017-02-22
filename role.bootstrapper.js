// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const c = require('creep');
const resources = require('resources');
const builder = require('role.builder');
const upgrader = require('role.upgrader');
const util = require('util');


// Get as many WORK, MOVE, CARRY, MOVE as we can fit
// within our energy capacity. This way it can move full
// speed over non-roads, non-swamps
// NOTE: Make this sensitive to the available energy reserves in storage,
// and make smaller ones when we have low reserves.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const groupCost = 250;
    const group = [WORK, MOVE, CARRY, MOVE];
    const maxGroups = 4;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    return retval;
} // spawn_body


function act(creep) {
    c.deliver_structure(creep, [STRUCTURE_EXTENSION, STRUCTURE_SPAWN], RESOURCE_ENERGY) ||
        c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.85) ||
        (creep.ticksToLive > 150 ? c.repair_ramparts(creep) : false) ||
        (creep.ticksToLive > 500 ? c.build(creep, true) : false) ||
        c.upgrade_room_controller(creep);
}

// This does builder stuff until it's 500 old then moves to
// upgrader stuff so we don't get downgraded
function run(creep) {
    c.harvest_or_act(creep, builder.builder_harvest, act, null, null);
}


module.exports = {
    run,
    spawn_body,
};
