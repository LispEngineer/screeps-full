// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const this_role = 'upgrader';
const c = require('creep');
const mylinks = require('link');
const resources = require('resources');
const builder = require('role.builder');


// If we have more than this energy in storage, build an extra upgrader creep.
const EXTRA_UPGRADER_STORAGE = 150000;

// Room overrides
const ROOM_DESIRED = {
    // 'W55S31': 3,
};

// What to do when we're harvesting
// We use the link to save us some running around, of possible.
function upgrader_harvest(creep) {
    // Try to get stuff from storage first, but if not,
    // then get it from our usual source.
    // We always want to try getting stuff from our link, though.
    // Allow this to get from containers if we have no storage yet...
    
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
    let structureTypes = [STRUCTURE_LINK, STRUCTURE_STORAGE];

    if (_.get(ri, ['structure_info',STRUCTURE_STORAGE,'count'], 0) <= 0) {
        structureTypes = [STRUCTURE_CONTAINER].concat(structureTypes);
    }

    if (!c.reload_energy(creep, structureTypes, undefined,
                         s => s.structureType != STRUCTURE_LINK || !mylinks.is_source(s),
                         creep.carryCapacity / 4)) {
        if (!c.harvest(creep)) {
            c.move_to_closest(creep, structureTypes);
        }
    }
}

function upgrader_act(creep) {
    c.upgrade_room_controller(creep);
}


function run(creep) {
    if (_.sum(creep.carry) - creep.carry.energy > 0) {
        console.log(creep.name, creep.pos, 'has non-energy; dropping it');
        for (const resourceType in creep.carry) {
            if (resourceType != RESOURCE_ENERGY) {
                creep.drop(resourceType);
            }
        }
        // c.deliver_structure(creep, [STRUCTURE_CONTAINER, STRUCTURE_TERMINAL, STRUCTURE_STORAGE], null);
        // return;
    }
    c.harvest_or_act(creep, upgrader_harvest, upgrader_act, null, null, false); // False == use only energy
} //  harvester_action_run



// Get as many WORK, CARRY, MOVE as we can fit
// within our energy capacity, if we have no links,
// otherwise, do CARRY, WORKx3, MOVEx2.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    if (ri.num_links > 2) {
        const groupCost = 450;
        const group = [CARRY, WORK, WORK, WORK, MOVE, MOVE];
        let maxGroups = 6;
        const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
        let retval = [];

        // We ignore the energyAvail
        for (let i = 0; i < numGroups; i++) {
            retval = retval.concat(group);
        }
        return retval;
    }

    const groupCost = 200;
    const group = [CARRY, WORK, MOVE];
    let maxGroups = 6;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    return retval;
} // spawn_body


// How many of these guys are desired in the specified room?
// 1. With 2+ links: one if we have a link, or two if we have a lot of resources
// 2. Without links: 3 minus the number of builders we need
// 3. Once we have storage, we should have fewer.
function num_desired(room) {

    if (ROOM_DESIRED[room.name] != null) {
        // console.log('Overridden creeps for room', room.name, ROOM_DESIRED[room.name]);
        return ROOM_DESIRED[room.name];
    }

    const ri = resources.summarize_room(room);
    // FIXME: This needs to use roles.get_num_desired but it cannot because it will
    // create a circular reference. <sigh>
    let builders = builder.num_desired(room);
    
    if (builders == null || builders < 0) { builders = 0; }

    if (ri.num_links > 1) {
        return global.role_info[this_role].desired + (ri.storage_energy > EXTRA_UPGRADER_STORAGE ? 1 : 0);
    }

    if (ri.has_storage) {
        return 1 + (ri.storage_energy > EXTRA_UPGRADER_STORAGE ? 1 : 0);
    }

    let num_upgraders = 3 - builders;

    if (num_upgraders < 1) { num_upgraders = 1; }

    return num_upgraders;
} // num_desired




module.exports = {
    run,
    spawn_body,
    num_desired,

    // Shared for other roles
    upgrader_harvest,
    upgrader_act,
};
