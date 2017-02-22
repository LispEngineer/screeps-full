// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// This creep just moves stuff from containers to extensions, spawn, and storage.
// It probably doesn't need any WORK modules.
"use strict";
const util = require('util');
const c = require('creep');
const mylinks = require('link');
const resources = require('resources');

// FILLER
//
// Responsible for taking energy out of storage (and NOT containers)
// and distributing it to the spawn, extensions and tower.

const MINIMUM_STORAGE_FOR_EXTRA_FILLERS = 45000;
const MINIMUM_STORAGE_TO_FILL_LINKS = 15000;

// Room overrides
const ROOM_DESIRED = {
    // 'W54S31': 2,
};



// TODO: Add a "transferring" flag to the target so different fillers
// will always choose different targets... Like we did with repair.

// TODO: If we haven't had to fill anything and have just been sitting
// around for N ticks, revert to harvest to get more stuff to fill for
// later.

// If we're waiting to fill our energy for more than this long,
// switch to active.
const MAX_WAITING = 10;

// If our tower energy is too low, spawn another.
const MIN_PER_TOWER_ENERGY = 500;


// Get energy from the storage (of which there's only one per room).
// If there is no storage, get it from a container. If there is no
// container... Uh.
function do_harvest(creep) {
    // See if there are places with a lot of energy, then get it
    if (c.pickup_ground_energy(creep)) {
        return true;
    }
    c.clear_ground_energy_memory(creep);

    const ri = resources.summarize_room(creep.room);
    let structureTypes = [STRUCTURE_STORAGE];

    if (_.get(ri, ['structure_info',STRUCTURE_STORAGE,'count'], 0) <= 0) {
        structureTypes = [STRUCTURE_CONTAINER].concat(structureTypes);
    }

    c.pickup_adjacent(creep);

    if (!c.reload_energy(creep, structureTypes, true)) {
        c.move_to_closest(creep, structureTypes);
        if (creep.memory.last_reload && Game.time - creep.memory.last_reload > MAX_WAITING &&
            creep.carry.energy > 0) {
            console.log(creep.name + ' acting due to lack of energy input');
            creep.memory.acting = true;
        } else if (creep.memory.last_reload == null) {
            creep.memory.last_reload = Game.time;
        }
    } else {
        // TODO: We just reloaded, get rid of any non-energy we have
        
        creep.memory.last_reload = Game.time;
    }
} // do_harvest

// What to do when we're acting
// Fill the tower only when it gets below 85%, under normal circumstances
// Fill the tower as highest priority when enemies are here.
// Or fill the tower as highest priority if it's less than 10% if we have at least 300 spawn energy (for emergency spawn)
function do_act(creep) {
    const ri = resources.summarize_room(creep.room);
    const stored_energy = ri.storage_energy;

    c.pickup_adjacent(creep);
    
    // If we have multiple creeps of this type in a room, then have them have different priorities.
    // The last creep in the room has a "secondary" priority.
    const fellow_fillers = _.filter(Game.creeps, c => c.room.name == creep.room.name && c.memory.role == creep.memory.role)
                            .sort((a,b) => b.name - a.name);
    // console.log(creep.name, 'fellow fillers:', JSON.stringify(fellow_fillers.map(c => c.name)));
    // We should do secondary filling priority if we're the last filler
    const secondary = fellow_fillers.length > 1 && fellow_fillers[fellow_fillers.length - 1].name == creep.name;
    // console.log(creep.name, 'fellows:', JSON.stringify(fellow_fillers.map(c => c.name)), 'secondary:', secondary);
    // if (secondary) { creep.say('S'); }

    // Try several deliveries until we have one that works.
    let filled;
    
    // common priorities
    filled =
        (ri.num_enemies > 0 ? c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.75) : false) ||
        (ri.energy_avail >= 3000 ? c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.10) : false);
    
    if (!secondary) {
        // primary filling priorities
        filled = filled ||
            c.deliver_structure(creep, [STRUCTURE_SPAWN, STRUCTURE_EXTENSION], RESOURCE_ENERGY) ||
            c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.50) ||
            (stored_energy > MINIMUM_STORAGE_TO_FILL_LINKS ?
                c.deliver_structure(creep, [STRUCTURE_LINK], RESOURCE_ENERGY, undefined,
                                l => mylinks.is_source(l) && !mylinks.is_nofill(l)) : false) ||
            (ri.energy_avail > 10000 ? c.deliver_structure(creep, [STRUCTURE_TERMINAL], RESOURCE_ENERGY, 0.0333) : false) || // = 10,000
            c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.85) ||
            c.deliver_structure(creep, [STRUCTURE_TERMINAL], RESOURCE_ENERGY, 0.05) || // = 15,000
            c.deliver_structure(creep, [STRUCTURE_LINK], RESOURCE_ENERGY, undefined, l => mylinks.is_source(l)  && !mylinks.is_nofill(l)) ||
            c.deliver_structure(creep, [STRUCTURE_LAB], RESOURCE_ENERGY) ||
            c.deliver_structure(creep, [STRUCTURE_NUKER], RESOURCE_ENERGY);
    } else {
        // secondary filler priorities
        filled = filled ||
            c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.50) ||
            c.deliver_structure(creep, [STRUCTURE_TERMINAL], RESOURCE_ENERGY, 0.10) || // = 30,000
            c.deliver_structure(creep, [STRUCTURE_TOWER], RESOURCE_ENERGY, 0.85) ||
            c.deliver_structure(creep, [STRUCTURE_SPAWN, STRUCTURE_EXTENSION], RESOURCE_ENERGY) ||
            c.deliver_structure(creep, [STRUCTURE_LINK], RESOURCE_ENERGY, undefined, l => mylinks.is_source(l) && !mylinks.is_nofill(l)) ||
            c.deliver_structure(creep, [STRUCTURE_NUKER], RESOURCE_ENERGY) ||
            c.deliver_structure(creep, [STRUCTURE_LAB], RESOURCE_ENERGY);
    }

    // If we have nothing to fill, and we're below full, then let's go back to harvesting.
    // TODO: Make it wait a few ticks first, unless it's carrying below X%?
    if (!filled) {
        if (creep.carry.energy < creep.carryCapacity) {
            creep.memory.acting = false;
        } else {
            // When we're full, get away from the containers to make room for
            // other fillers/harvesters
            c.move_to_closest(creep, [STRUCTURE_SPAWN]);
        }
    }
} // do_act


function run(creep) {
    const death_imminent = 25;

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
// within our energy capacity, up to 4,
// Not this anymore: Unless we have no stored energy, in which case
// let's use 6.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const groupCost = 150;
    const group = [CARRY, CARRY, MOVE];
    const maxGroups = 4; // ri.storage_energy > 0 ? 4 : 6;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    return retval;
} // spawn_body


// How many of these guys are desired in the specified room?
// 1. Zero if we can't have containers
// 2. One if we can't have storage
// 3. Maximum of two if we have a minimal storage reserve
function num_desired(room) {

    if (ROOM_DESIRED[room.name] != null) {
        // console.log('Overridden creeps for room', room.name, ROOM_DESIRED[room.name]);
        return ROOM_DESIRED[room.name];
    }
    
    const ri = resources.summarize_room(room);

    // Nothing to harvest into at this level
    if (CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][ri.controller_level] <= 0) {
        return 0;
    }
    // Nothing to harvest into at this level
    if (CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][ri.controller_level] <= 0) {
        // If our tower isn't full, let's store stuff into it
        if (ri.num_towers > 0 && ri.tower_energy < MIN_PER_TOWER_ENERGY * ri.num_towers) {
            return 2;
        }
        return 1;
    }

    // Once we have storage, let's fill from it quickly once we have a minimal reserve
    if (ri.storage_energy >= MINIMUM_STORAGE_FOR_EXTRA_FILLERS) {
        return 2;
    } else {
        return 1;
    }
} // num_desired


module.exports = {
    run,
    spawn_body,
    num_desired,
};
