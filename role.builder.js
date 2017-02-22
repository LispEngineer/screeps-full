// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const this_role = 'builder';

const util = require('util');
const c = require('creep');
const mylinks = require('link');
const resources = require('resources');

// TODO: Make a builder also pump a few repairs into newly
// built ramparts...

// Room overrides
const ROOM_DESIRED = {
    // 'W54S31': 4,
};



// What to do when we're harvesting
function builder_harvest(creep) {
    // Try to get stuff from storage first, but if not,
    // then get it from our usual source
    // Allow this to get from containers if we have no storage yet...
    // TODO: Allow this to harvest from links ONLY if it's going to be building...

    // First, get stuff from the ground.
    if (c.pickup_ground_energy(creep)) {
        return;
    }
    c.clear_ground_energy_memory(creep);

    // Mostly for bootstrappers who came into a room with enemy structures
    if (c.load_hostile_energy(creep)) {
        return;
    }

    const ri = resources.summarize_room(creep.room);
    let structureTypes = [/* STRUCTURE_LINK, */ STRUCTURE_STORAGE];
    const withdraw_at_least = creep.carryCapacity / 4;

    if (_.get(ri, ['structure_info',STRUCTURE_STORAGE,'count'], 0) <= 0) {
        structureTypes = [STRUCTURE_CONTAINER].concat(structureTypes);
    }

    // TODO: Have it only reload from a container if it has a minimum amount
    // such as 50, otherwise harvest it itself.
    if (!c.reload_energy(creep, structureTypes, ri.controller_level < 4, // Get from most filled structure?
                                s => s.structureType != STRUCTURE_LINK || !mylinks.is_source(s),
                                withdraw_at_least)) {
        if (!c.harvest(creep)) {
            // If can't harvest, at least move to where the energy is while waiting.
            c.move_to_closest(creep, structureTypes);
        }
    }
} // builder_harvest

function builder_act(creep) {
    c.repair_ramparts(creep) ||
    c.build(creep, true) || c.upgrade_room_controller(creep);
}

function run(creep) {
    c.harvest_or_act(creep, builder_harvest, builder_act, null, null);
} //  harvester_action_run



// Get body parts of alternating [CWM] or [CCM] until we're out of available
// energy capacity.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    let energyCap = ri.energy_cap;

    const groups = [[CARRY, WORK, MOVE], [CARRY, CARRY, MOVE]];
    const groupCosts = [200, 150];
    const maxGroups = 6;
    let retval = [];

    // Add until we can't add anymore
    for (let i = 0; i < maxGroups; i++) {
        if (energyCap < groupCosts[i % groupCosts.length]) {
            break;
        }
        energyCap -= groupCosts[i % groupCosts.length];
        retval = retval.concat(groups[i % groups.length]);
    }
    return retval;
} // spawn_body


// How many of these guys are desired in the specified room?
// 1. Zero if we have no build sites
// 2. Otherwise, whatever the role says
// @param room Room object, not name
function num_desired(room) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    if (room.find(FIND_CONSTRUCTION_SITES, {filter: cs => cs.my}).length == 0) {
        // console.log('No builders needed for no construction sites.');
        return 0;
    }

    if (ROOM_DESIRED[room.name] != null) {
        // console.log('Overridden creeps for room', room.name, ROOM_DESIRED[room.name]);
        return ROOM_DESIRED[room.name];
    }

    return global.role_info[this_role].desired;
}


module.exports = {
    run,
    spawn_body,
    num_desired,

    // For sharing
    builder_harvest,
};
