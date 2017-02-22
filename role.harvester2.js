// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const util = require('util');
const resources = require('resources');
const this_role = 'harvester2';
// const c = require('creep');


// Harvester V2
//
// Body: 6x WORK and 1x MOVE
//
// This harvester is designed to work like this:
// 1. (Manually?) Build a container adjacent to an energy source
// 2. This harvester, at initialization time, will loop
//    through all harvesters and find which sources other
//    harvesters are assigned to.
// 3. It will pick a source with no other harvesters, and
//    save it in its memory.
// 4. It will search for the adjacent container to the selected
//    source, and go there. (And save it in the memory.)
// 5. It will start harvesting, and since it has no CARRY, it will
//    just drop into the container at that point.
// 6. It sits there until it dies.
//
// Three WORK modules will allow the harvester to get six energy per
// tick. Since energy respawns every 300 ticks to 3,000, we can get
// 3,600 energy out during this time, giving us a buffer of 60 ticks
// to respawn when a harvester dies.

// This is designed to work with two other types of creeps.
// fetcher - Moves energy to Storage from Containers (and on the ground)
// filler  - Take energy from Storage (or Containers if no storage)
//           and puts to tower, extensions and spawn

// CORNER CASES
// 1. If sources are almost adjacent, this could present a difficulty.
// 2. If another creep is standing on our container, we'll just wait.
// 3. If the container is destroyed or removed, we'll just harvest onto
//    the ground, so make sure the fetcher will pick stuff up off the
//    ground occasionally. The next harvester will just not do anything.
// 4. When we can't have containers yet (too low a RoomController Level),
//    we need to use our old style harvesters.

// MEMORY ITEMS
// home_room: NAME of the room this harvester lives in
// source_id: ID of the source this harvester harvests
// container_id: ID of the container this harvester stands on
// container_x/y: x, y position of the location this harvester stands on
// in_position: boolean saying whether we're ready to harvest
// initialized: boolean saying if we have set all the above variables

// TODO: Add a bootstrapping mode where if we can't build our maximum
// size bodies harvester2, filler, transfer, then we just build size
// 300 until we have at least one of each so we can build as big as
// we possibly could.
// This will need to modify the spawn_body with a lot more logic.



// Assume this is called only once, and sets initialized at the end.
// Returns true if we succeed, or false on any error.
//
// Go through every source, and every adjacent container to every
// source, and pick one nobody else has taken.
//
// NOTE: THIS MUST MATCH CALCULATIONS IN resources.count_source_containers()!!!
function determine_destination(creep) {
    const myrole = creep.memory.role; // Set at spawn time
    const myroom = creep.pos.roomName;

    // TODO: Check if we're already initialized and return false?
    // Or, allow reinitialization, after clearing our own settings?

    creep.memory.home_room = myroom;
    creep.memory.in_position = false;

    // Find all OTHER initialized creeps in this room with this role
    let other_creeps = _.filter(Game.creeps,
        c => c.memory.role == myrole &&
        c.memory.home_room == myroom &&
        c.name != creep.name &&
        c.memory.initialized);
    // Find all sources in this room
    let room_sources = Game.rooms[myroom].find(FIND_SOURCES);

    // Go through all sources and all nearby containers, and pick one that is not
    // claimed by another harvester2 for now.
    // TODO: Prefer to pick one at a source that isn't already claimed.
    let chosen_source, chosen_container;

    source_container_search:
    for (let source of room_sources) {
        let nearby_containers =
            source.pos.findInRange(FIND_STRUCTURES, 2, { filter: s => s.structureType == STRUCTURE_CONTAINER });
        for (let nc of nearby_containers) {
            if (nc.pos.getRangeTo(source) >= 2.0) {
                // We can't say 1.999 above I don't think, in the findInRange, so double check.
                continue;
            }
            const claimed = _.any(other_creeps, oc => oc.memory.container_id == nc.id);
            if (claimed) {
                continue;
            }
            chosen_source = source;
            chosen_container = nc;
            break source_container_search;
        } // nearby_containers
    } // room_sources

    if (chosen_source == null) {
        console.log(creep.name + ' could not find unclaimed source/container in room ' + creep.room.name);
        return false;
    }

    // OK, so we also found a container & source
    creep.memory.source_id = chosen_source.id;
    creep.memory.container_id = chosen_container.id;
    creep.memory.container_x = chosen_container.pos.x;
    creep.memory.container_y = chosen_container.pos.y;

    // So, we're all initialized.
    creep.memory.in_position = false;
    creep.memory.initialized = true;
    console.log(creep.name + ' fully initialized. Going to: ' + chosen_container.pos);
    return true;
} // determine_destination




// Get one MOVE plus as many WORK as we can fit
// within our energy capacity.
// MOVE = 50
// WORK = 100
// We ignore the energyAvail
//
// OK, look at the number of source containers we have, and the number
// of sources we have. If the number of source containers > number of sources,
// then each harvester needs fewer WORK parts.
//
// If we have just one container for a source, let's use 6 (5 would work perfectly,
// 6 would have some extra). For two containers for a source, let's use 4, even though
// 3 would work fine like 6. Let's calculate these numbers.
//
// TODO: Make these numbers calculate based upon source maximums
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const containersPerSource = Math.floor(ri.num_source_containers / ri.num_sources);

    const baseCost = 50;
    const workCost = 100;
    // 5 WORKs will just barely pull all 3,000; 6 is safer if we can afford it.
    const maxGroups = Math.ceil(5 / containersPerSource) + 1;
    const group = [WORK];
    let numGroups = Math.min(maxGroups, Math.floor((energyCap - baseCost) / workCost));
    let retval = [MOVE];

    // console.log('harvester2 numGroups for room ' + room.name + ': ' + numGroups);

    if (numGroups > maxGroups) {
        numGroups = maxGroups;
    }
    // Let's put our MOVE at the end so we can always move if we're attacked.
    for (let i = 0; i < numGroups; i++) {
        retval = group.concat(retval);
    }
    return retval;
} // spawn_body



// What to do when we're harvesting
function harvest(creep) {
    const mysource = Game.getObjectById(creep.memory.source_id);

    const x = creep.memory.container_x;
    const y = creep.memory.container_y;
    const myx = creep.pos.x;
    const myy = creep.pos.y;

    if (!creep.memory.in_position) {
        // Check if we got into position
        if (x == myx && y == myy) {
            creep.memory.in_position = true;
        }
    }
    // FIXME: Do we ever want to check if we get out of position?

    if (creep.memory.in_position) {
        const harvested = creep.harvest(mysource);
        if (harvested != OK && harvested != ERR_NOT_ENOUGH_RESOURCES) {
            console.log(creep.name + ' unable to harvest from source ' + mysource.id + ' at ' + mysource.pos);
        }
    } else {
        // (continue to...) move to our position
        // console.log(creep.name + ' moving into position ' + x + ',' + y + ' in ' + creep.room);
        const moved = creep.moveTo(x, y, { maxRooms: 1 });

        if (moved != OK && moved != ERR_TIRED) {
            console.log(creep.name + ' moving to ' + x + ',' + y + ' got error : ' + moved);
        }
    }

} // harvest

function run(creep) {
    // Check if we're initialized. If not...
    if (typeof creep.memory.initialized == 'undefined' ||
        !creep.memory.initialized) {
        console.log('Initializing creep ' + creep.name);
        determine_destination(creep);
        // TODO: Send a game notification if we can't initialize?
        // Turn ourselves into a harvester v1 if we can't initialize? Not useful, no CARRY!
    }

    // Check that our initialization was successful, or were previously initialized
    if (creep.memory.initialized) {
        harvest(creep);
    }
} // run


// How many of these guys are desired in the specified room?
// 1. Zero if we can't have containers
// 2. Otherwise one per container
function num_desired(room) {
    const ri = resources.summarize_room(room);

    // Nothing to harvest into at this level
    if (CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][ri.controller_level] <= 0) {
        return 0;
    }
    // Actually nothing to harvest into
    if (ri.num_containers <= 0) {
        return 0;
    }
    // Not enough containers
    if (ri.num_sources > ri.num_containers) {
        return 0;
    }

    // TODO: Check if we have a container next to each source, and if so,
    // return the number of spawns, or otherwise 0.

    return Math.max(ri.num_sources, ri.num_source_containers);
}


module.exports = {
    run,
    spawn_body,
    num_desired,

    // Exported for testing purposes only
    determine_destination,
    harvest,
};
