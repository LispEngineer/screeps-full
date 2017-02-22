// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Functions useful to all creeps

"use strict";
// const profiler = require('screeps-profiler');
const util = require('util');
const emoji = require('emoji');
const resources = require('resources');
const flag = require('flag');
const repr = require('repair'); // Repair require


let out_of_energy_tick = null;

const FLAG_COLOR_ROOM_AVOID = COLOR_RED;
const FLAG_SEC_ROOM_AVOID = COLOR_RED;


// Retreats if there are enemies in the target room.
// Returns true if we're dealing with enemies.
// Calls retreat_func with (creep) to effect the retreat.
// Uses the memory cell "retreating" on a creep.
function retreat_from_enemies(creep, target_room, retreat_func) {
    let retreating = creep.memory.retreating;
    const ri = resources.summarize_room(target_room);
    const RETREAT_FOR = 10;

    if (ri == null && retreating == null) {
        // If we've lost visibility into our target room, we'll be unable to
        // get room info on it. Assume it's safe to go back again.
        // console.log('Room info is null?', target_room);
        return false;
    }

    // If we know there are no enemies, let's go back
    if (ri != null && ri.num_enemies <= 0) {
        delete creep.memory.retreating;
        return false;
    }

    // Assert: We know there are enemies OR we know that we were previously retreating

    // If we were previously retreating, keep retreating for a while
    if (ri == null && retreating != null && retreating > 0) {
        // Keep retreating
        console.log(creep.name, 'retreating from room', target_room, 'due to old enemies for more ticks:', retreating);
        retreat_func(creep);
        retreating--;
        if (retreating > 0) {
            creep.memory.retreating = retreating;
        } else {
            delete creep.memory.retreating;
        }
        return true;
    }

    console.log(creep.name, 'retreating from room', target_room, 'due to enemies:', ri.num_enemies,
                'for ticks:', RETREAT_FOR);
    retreat_func(creep);
    creep.memory.retreating = RETREAT_FOR;
    return true;
}
// retreat_from_enemies = profiler.registerFN(retreat_from_enemies, 'creep.retreat_from_enemies');




// Handles a creep which can be harvesting or acting.
// If it's harvesting, it calls the fn_harv to handle.
// If it's acting, it calls fn_act to handle.
// When we start harvesting or acting, we call fn_start_harv and fn_start_act.
// These functions are called with the creep as an argument.
// It swaps if we're acting and have nothing we're carrying, OR
// if we're not acting and we're full of stuff we're carrying.
// use_total = if true, use total carry, otherwise use just energy
function harvest_or_act(creep, fn_harv, fn_act, fn_start_harv, fn_start_act,
                        use_total = true) {

    const total_carry = use_total ? _.sum(creep.carry) : creep.carry.energy;

    // First, change mode
    if (creep.memory.acting && total_carry == 0) {
        creep.memory.acting = false;
        creep.say('harvesting');
        if (fn_start_harv != null) { fn_start_harv(creep); }
    }
    if (!creep.memory.acting && total_carry == creep.carryCapacity) {
        creep.memory.acting = true;
        creep.say('acting');
        if (fn_start_act != null) { fn_start_act(creep); }
    }

    // Now act (or harvest)
    if (creep.memory.acting) {
        fn_act(creep);
    } else {
        fn_harv(creep);
    }
} // act_or_harvest
// harvest_or_act = profiler.registerFN(harvest_or_act, 'creep.harvest_or_act');


// Picks up any energy located at the specified location
function pickup_at(creep, x, y) {
    const items = creep.room.lookForAt(LOOK_ENERGY, x, y);
    // const getMe = _.find(items, {resourceType: RESOURCE_ENERGY});

    // console.log('Items: ' + JSON.stringify(items, null, 2));

    if (items == null || items.length == 0) {
        console.log("Nothing to pick up at " + x + "," + y);
        return false;
    }

    const target = items[0];

    // console.log(creep.name + " picking up energy " + target.energy + " at " + x + "," + y + ' in ' + creep.room.name);
    const result = creep.pickup(target);
    if (result != OK) {
        console.log("...but failed: ", util.error_name(result));
    }
} // pickup_at
// pickup_at = profiler.registerFN(pickup_at, 'creep.pickup_at');

/*
Items: [
  {
    "x": 5,
    "y": 12,
    "energy": {
      "room": {
        "name": "W59S32",
        "mode": "world",
        "energyAvailable": 400,
        "energyCapacityAvailable": 800
      },
      "pos": {
        "x": 5,
        "y": 12,
        "roomName": "W59S32"
      },
      "id": "5836f72f30e1e90a656063d9",
      "energy": 581,
      "amount": 581,
      "resourceType": "energy"
    }
  },
  {
    "x": 5,
    "y": 12,
    "energy": {
      "room": {
        "name": "W59S32",
        "mode": "world",
        "energyAvailable": 400,
        "energyCapacityAvailable": 800
      },
      "pos": {
        "x": 5,
        "y": 12,
        "roomName": "W59S32"
      },
      "id": "5836f7499fcc41372f5d0b2e",
      "amount": 89,
      "resourceType": "GO"
    }
  },
  {
    "x": 5,
    "y": 12,
    "energy": {
      "room": {
        "name": "W59S32",
        "mode": "world",
        "energyAvailable": 400,
        "energyCapacityAvailable": 800
      },
      "pos": {
        "x": 5,
        "y": 12,
        "roomName": "W59S32"
      },
      "id": "5836f7499fcc41372f5d0b2f",
      "amount": 11,
      "resourceType": "KO"
    }
  },
  {
    "x": 5,
    "y": 12,
    "energy": {
      "room": {
        "name": "W59S32",
        "mode": "world",
        "energyAvailable": 400,
        "energyCapacityAvailable": 800
      },
      "pos": {
        "x": 5,
        "y": 12,
        "roomName": "W59S32"
      },
      "id": "5836f7499fcc41372f5d0b30",
      "amount": 17,
      "resourceType": "ZH"
    }
  },
  {
    "x": 5,
    "y": 12,
    "energy": {
      "room": {
        "name": "W59S32",
        "mode": "world",
        "energyAvailable": 400,
        "energyCapacityAvailable": 800
      },
      "pos": {
        "x": 5,
        "y": 12,
        "roomName": "W59S32"
      },
      "id": "5836f7499fcc41372f5d0b31",
      "amount": 5,
      "resourceType": "UH"
    }
  }
]
*/

// Checks around us for energy, and if any is found, picks it up.
// Returns false if nothing is picked up for any reason (error, nothing found, etc.)
function pickup_adjacent(creep) {

    if (_.sum(creep.carry) >= creep.carryCapacity) {
        return false;
    }

    const x = creep.pos.x;
    const y = creep.pos.y;
    // true means return as an array with three items: x, y, and "structure" which contains
    // whatever it found.
    const sx = Math.max(0, x - 1);
    const sy = Math.max(0, y - 1);
    const ex = Math.min(49, x + 1);
    const ey = Math.min(49, y + 1);
    let items = creep.room.lookForAtArea(LOOK_ENERGY, sy, sx, ey, ex, true);

    if (items == null || items.length == 0) {
        // console.log("Nothing to pick up around " + x + "," + y);
        return false;
    }

    // This seems like it may be returning non-energy sometimes
    // console.log('Items: ' + JSON.stringify(items, null, 2));
    // Returns an array of objects like the above, very oddly shaped/defined
    items = _.filter(items, i => i.energy.resourceType == RESOURCE_ENERGY);

    if (items == null || items.length == 0) {
        // console.log("No energy to pick up around " + x + "," + y);
        return false;
    }

    // console.log('Items after filter: ' + JSON.stringify(items, null, 2));

    const target = items[0];

    // console.log(creep.name + " picking up energy " + target.energy.amount + " at " + target.x + "," + target.y + ' from ' + x + ',' + y + ' in ' + creep.room.name);
    const result = creep.pickup(target.energy);
    if (result != OK) {
        console.log(creep.name, creep.pos, "failed picking up energy: ", util.error_name(result) /* + "\n" + JSON.stringify(target.energy, null, 2) */);
        return false;
    }
    return true;
} // pickup_at
// pickup_adjacent = profiler.registerFN(pickup_adjacent, 'creep.pickup_adjacent');

// If there is anywhere that has > 50% of our carry capacity,
// go get it, unless there are enemies around.
// If you sort by "biggest" then creeps will wander around
// when others pick up stuff on the ground. If you sort by
// closest, then at least they will go to one place until
// it gets too small.
function pickup_ground_energy(creep, biggest = false) {
    const ri = resources.summarize_room(creep.room);
    const min_energy = creep.carryCapacity / 2;

    if (ri.num_enemies > 0) {
        delete creep.memory.pickup_ground_energy;
        return false;
    }
    if (ri.ground_resources[RESOURCE_ENERGY] < min_energy) {
        delete creep.memory.pickup_ground_energy;
        return false;
    }

    const ground_resources = creep.room.find(FIND_DROPPED_RESOURCES,
                                       { filter: res => res.resourceType == RESOURCE_ENERGY &&
                                                        res.amount >= min_energy });
    let prio;
    
    if (biggest) {
        prio = ground_resources.sort((a, b) => b.amount - a.amount);
    } else {
        prio = util.sort_proximity(creep, ground_resources);
    }
    
    if (prio.length == 0) {
        delete creep.memory.pickup_ground_energy;
        return false;
    }
    
    let found;
    if (creep.memory.pickup_ground_energy) {
        // We remembered where we were going last time, if it still has energy, still go there.
        for (const gr of ground_resources) {
            if (gr.pos.x == creep.memory.pickup_ground_energy.x && 
                gr.pos.y == creep.memory.pickup_ground_energy.y) {
                if (gr.amount >= min_energy) {
                    found = gr;
                }
                break;
            }
        }
        // console.log(creep.name, 'going to remembered ground pickup location', JSON.stringify(creep.memory.pickup_ground_energy));
    }
    
    if (found == null) {
        creep.memory.pickup_ground_energy = prio[0].pos;
        // console.log(creep.name, 'remembering ground pickup location', JSON.stringify(creep.memory.pickup_ground_energy));
        found = prio[0];
    }

    creep.moveTo(found, { range: 1 });
    pickup_adjacent(creep);
    // Load energy in case there is a container adjacent to us too
    // FIXME: This seems to be bugged...
    /*
    if ((creep.carryCapacity - _.sum(creep.carry)) < found.amount) {
        reload_energy(creep, undefined, undefined, undefined, undefined, true);
    }
    */
    return true;
} // do_pickup
// pickup_ground_energy = profiler.registerFN(pickup_ground_energy, 'creep.pickup_ground_energy');

function clear_ground_energy_memory(creep) {
    delete creep.memory.pickup_ground_energy;
}
// clear_ground_energy_memory = profiler.registerFN(clear_ground_energy_memory, 'creep.clear_ground_energy_memory');


function hostile_energy_structures(room) {
    if (global.volatile.hostile_energy &&
        global.volatile.hostile_energy[room.name]) {
        return global.volatile.hostile_energy[room.name];
    }
    if (global.volatile.hostile_energy == null) {
        global.volatile.hostile_energy = {};
    }

    let hs = room.find(FIND_HOSTILE_STRUCTURES, { filter:
        s => (typeof s.store === 'undefined'  || s.store.energy > 0) &&
             (typeof s.energy === 'undefined' || s.energy > 0) &&
             (typeof s.store !== 'undefined' || typeof s.energy !== 'undefined') &&
             s.structureType != STRUCTURE_RAMPART });
    // FIXME: Filter out structures with enemy ramparts on them.

    global.volatile.hostile_energy[room.name] = hs;
    return hs;
}
// hostile_energy_structures = profiler.registerFN(hostile_energy_structures, 'creep.hostile_energy_structures');

// Gets energy from an enemy structure, if any,
// which don't have an enemy rampart there.
function load_hostile_energy(creep) {
    let hs = hostile_energy_structures(creep.room);
    // console.log(creep.name, creep.room.name, 'hostile structures with energy', JSON.stringify(hs.map(s => s.structureType + ' ' + s.pos.x + ',' + s.pos.y)));

    if (hs.length <= 0) {
        // console.log(creep.name, creep.room.name, 'no hostile structures to pull energy from');
        return false;
    }
    // Pick closest target
    hs = util.sort_proximity(creep, hs);

    const target = hs[0];

    // Then get anything else
    let result = creep.withdraw(target, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
        result = creep.moveTo(target, {maxRooms: 1, range: 1});
        if (result != OK) {
            console.log(creep.name, 'moving to hostile', target.structureType, target.pos, 'error', util.error_name(result));
        } else {
            console.log(creep.name, 'moving to load from hostile', target.structureType, target.pos);
        }
    } else if (result != OK) {
        console.log(creep.name, 'loading from hostile', target.structureType, target.pos, 'error', util.error_name(result));
    } else {
        console.log(creep.name, creep.room.name, 'loading from hostile', target.structureType, target.pos);
    }
    return true;
} // load_hostile_energy
// load_hostile_energy = profiler.registerFN(load_hostile_energy, 'creep.load_hostile_energy');



// Gets energy from the nearest storage facility.
// Returns false if there are no storage facilities
// with energy in this room.
// structureTypes = which kinds of structures to consider withdrawing from
//                  default is container, storage
// most_filled = Go to the most filled one if set, else closest
// filter_p = Filter the structures with this predicate
// withdraw_more_than = Go to one with at least this much filled
// without_moving = Don't move if we can't reload where we are right now (and return false if we have to move)
// TODO: Put some memory here about where we're getting our energy so we aren't
// constantly running from one container to another as they get slightly unfilled.
function reload_energy(creep, structureTypes = [STRUCTURE_CONTAINER, STRUCTURE_STORAGE],
                       most_filled = false, filter_p = null, withdraw_more_than = 0,
                       without_moving = false) {
    let mem_target_id = creep.memory.rel_ene_tgt;
    let mem_target = mem_target_id != null ? Game.getObjectById(mem_target_id) : null;
    let target = null;

    if (mem_target != null) {
        if ((typeof mem_target.store != 'undefined' && mem_target.store.energy <= withdraw_more_than) ||
            (typeof mem_target.energy != 'undefined' && mem_target.energy <= withdraw_more_than)) {
            mem_target = null;
        }
    }

    if (mem_target != null) {
        // console.log(creep.name, 'continuing to refill at', mem_target.structureType, mem_target.pos);
        target = mem_target;
    } else {

        // Find a new target
        let targets = util.find_structures(creep.room,
                                structure =>
                                    structureTypes.includes(structure.structureType) &&
                                    (typeof structure.store == 'undefined' || structure.store.energy > withdraw_more_than) &&
                                    (typeof structure.energy == 'undefined' || structure.energy > withdraw_more_than) &&
                                    (filter_p == null || filter_p(structure)));

        if (targets.length > 0) {
            if (most_filled) {
                // Sort with most energy first
                targets = targets.sort((a, b) => b.store.energy - a.store.energy);
            } else {
                // Pick closest target
                targets = util.sort_proximity(creep, targets);
            }
            target = targets[0];
        }

        if (target == null) {
            // No place has energy for us to get
            delete creep.memory.rel_ene_tgt;
            return false;
        }
        // console.log(creep.name, 'will to refill at', target.structureType, target.pos);
    }

    // First try to pick up energy from the ground there just in case
    // pickup_at(creep, target.pos.x, target.pos.y, RESOURCE_ENERGY);

    // Then get anything else
    const result = creep.withdraw(target, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
        if (without_moving) {
            return false;
        }
        creep.moveTo(target, {maxRooms: 1, range: 1});
        creep.memory.rel_ene_tgt = target.id;
    } else if (result == OK) {
        delete creep.memory.rel_ene_tgt;
    }
    return true;
} // reload_energy
// reload_energy = profiler.registerFN(reload_energy, 'creep.reload_energy');


// Gets specified mineral from the specified structure types,
// or null for any mineral (except energy).
// Returns false if there are no storage facilities
// with energy in this room.
// structureTypes = which kinds of structures to consider withdrawing from
//                  default is container, storage
// most_filled = Go to the most filled one if set, else closest
// filter_p = Filter the structures with this predicate
// withdraw_more_than = Go to one with at least this much filled
// without_moving = Don't move if we can't reload where we are right now (and return false if we have to move)
// TODO: Put some memory here about where we're getting our energy so we aren't
// constantly running from one container to another as they get slightly unfilled.
function load_resource(creep,
                       structureTypes = [STRUCTURE_CONTAINER, STRUCTURE_STORAGE],
                       resource = null) {

    // Find a new target
    let targets = util.find_structures(creep.room,
        structure =>
            structureTypes.includes(structure.structureType) &&
            (resource == null ? _.sum(structure.store) - structure.store.energy > 0 :
                                structure.store[resource] > 0));

    if (targets.length == 0) {
        console.log(creep.name, creep.room.name, 'has no structures to get resources from');
        return false;
    }

    // Pick closest target
    targets = util.sort_proximity(creep, targets);
    const target = targets[0];

    // Resources in the specified target
    const tres = _.remove(Object.keys(target.store), k => k != RESOURCE_ENERGY);

    if (tres.length == 0) {
        // console.log('[ERROR] No resources in target?', JSON.stringify(target));
        return false;
    }

    const result = creep.withdraw(target, tres[0]);
    // console.log(creep.name, 'getting', JSON.stringify(tres), 'from', target.pos, 'result', util.error_name(result),
    //             'target.store', JSON.stringify(target.store));
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {maxRooms: 1, range: 1});
    }
    return true;
}
// load_resource = profiler.registerFN(load_resource, 'creep.load_resource');



// Moves to the closest structure of the types provided.
// Returns true if we are on our way, false if we didn't
// find any matching structures.
function move_to_closest(creep, structureTypes) {
    let target;
    let targets = util.find_structures(creep.room, (s) => structureTypes.includes(s.structureType));

    if (targets.length == 0) {
        return false;
    }

    // Pick closest target
    targets = util.sort_proximity(creep, targets);
    target = targets[0];

    if (creep.pos == target.pos) {
        return true;
    }

    // TODO: Stop when we're adjacent?

    creep.moveTo(target, {maxRooms: 1, range: 1});
    return true;
} // move_to_closest
// move_to_closest = profiler.registerFN(move_to_closest, 'creep.move_to_closest');

// Attempts to harvest some energy. If there is nothing
// to harvest, return false, but move to a harvest point.
function harvest(creep) {
    const sources = util.find_sources(creep.room);
    let init_src, final_src;
    // console.log(sources);

    // Loop through all, and harvest from any source
    // which has spare capacity.
    let which_source = util.id_mod(creep, sources.length);
    init_src = sources[which_source];
    // console.log("harvesting: " + creep.name + ", source: " + which_source + " ea: " +
    //             (sources[which_source] != null ? sources[which_source].energy : "missing source"))
    // For unknown reason, sources[which_source] sometimes returns null
    if (sources[which_source] == null || sources[which_source].energy <= 0) {
        // console.log(creep.name, creep.room.name, "No energy available at source " + sources[which_source].id);
        // Find another source
        which_source = null;
        for (let s = 0; s < sources.length; s++) {
            if (sources[s].energy > 0) {
                which_source = s;
                break;
            }
        }
    }
    final_src = which_source == null ? null : sources[which_source];

    if (which_source == null) {
        if (Game.time != out_of_energy_tick) {
            out_of_energy_tick = Game.time;
            // console.log("No more energy to harvest! Tick: " + out_of_energy_tick);
            // Game.notify("No more energy to harvest! Tick: " + out_of_energy_tick);
            // Have creep move to one of the sources regardless.
            which_source = util.id_mod(creep, sources.length);
        }
        if (which_source == null || which_source > sources.length) {
            which_source = 0;
        }
        const r = creep.moveTo(sources[which_source], {maxRooms: 1, range: 1}); // ignoreCreeps: true,
        if (r != OK) {
            console.log(creep.name, creep.room.name, 'harvest (a) moving result:', util.error_name(r)); //, JSON.stringify(sources[which_source]));
        }
        return false;
    }

    const result = creep.harvest(sources[which_source]);
    // console.log(creep.name, 'harvesting', sources[which_source].pos, 'result', result,
    //             'init src', init_src.pos, 'final src', final_src.pos);
    if (result == ERR_NOT_IN_RANGE) {
        const r2 = creep.moveTo(sources[which_source], {maxRooms: 1, range: 1});
        if (r2 != OK && r2 != ERR_TIRED) {
            console.log(creep.name, creep.room.name, 'harvest moving result:', util.error_name(r2));
        }
    } else if (result != OK) {
        console.log(creep.name, creep.room.name, 'harvest result:', util.error_name(result));
    }
    return true;
} // harvest
// harvest = profiler.registerFN(harvest, 'creep.harvest');



// We deliver stuff to a structure. If we don't find a structure
// to deliver to, we return false.
// structs = array of structures we deliver to
// resource = what kind of resource to deliver, or null for all
// min_pct = number between 0 and 1 that if it's below that, we refill it
// filter_p = function taking one argument (a structure)
function deliver_structure(creep, structs, resource, min_pct = 1.0, filter_p = null) {

    if (min_pct <= 0) {
        // Nothing to do
        return false;
    }
    if (min_pct > 1.0) {
        min_pct = 1.0;
    }

    if ((resource && creep.carry[resource] <= 0) ||
        (!resource && _.sum(creep.carry) <= 0)) {
        console.log(creep.name + ' at ' + creep.pos + ' is not carrying any to transfer of resource ' + resource);
        return false;
    }

    // This counts two things:
    // 1. Whether there is enough room to put _anything_ in the structure
    // 2. Whether there is enough of the specific resource in the structure
    let targets = util.find_structures(creep.room, structure =>
        structs.includes(structure.structureType) &&
        // FIXME: This needs the total used not just energy... (for storage)
        (((typeof structure.energy !== 'undefined' && (resource == null || resource == RESOURCE_ENERGY)) &&
            structure.energy       < structure.energyCapacity * min_pct) ||
         ((typeof structure.store  !== 'undefined') &&
            ((resource == null ? _.sum(structure.store) : structure.store[resource]) < structure.storeCapacity * min_pct) &&
            (_.sum(structure.store) < structure.storeCapacity))) &&
        structure.isActive() &&
        (filter_p == null || filter_p(structure))
    );
    // if (creep.room.name == 'W55S31') {
    //     console.log(JSON.stringify(structs), 'resource', resource, 'min_pct', min_pct, 'structures:',
    //                 JSON.stringify(targets.map(t => t.structureType + ' ' + t.pos)));
    // }

    /* Old targeting code, just in case needed
    targets = util.find_structures(creep.room, structure =>
        structs.includes(structure.structureType) &&
        // FIXME: This needs the total used not just energy... (for storage)
         (((typeof structure.energy !== 'undefined') && structure.energy       < structure.energyCapacity * min_pct) ||
          ((typeof structure.store  !== 'undefined') && _.sum(structure.store) < structure.storeCapacity  * min_pct)) &&
        (filter_p == null || filter_p(structure))
    );
    */

    // console.log('Targets: ' + targets);
    // console.log('Targets sorted: ' + util.sort_proximity(creep, targets));

    if (targets.length > 0) {
        // Pick closest target
        targets = util.sort_proximity(creep, targets);
        let last_error = OK;
        if (resource == null) {
            for (let resourceType of Object.keys(creep.carry)) {
                // console.log(creep.name + ' is carrying ' + resourceType + ' ' + JSON.stringify(Object.keys(creep.carry)));
                if (creep.carry[resourceType] <= 0) {
                    // We will get an error if we try to transfer 0 and we will sometimes have zero energy
                    continue;
                }
                last_error = creep.transfer(targets[0], resourceType);
                if (last_error != OK) {
                    break;
                }
            }
        } else {
            last_error = creep.transfer(targets[0], resource)
        }
        if (last_error == ERR_NOT_IN_RANGE) {
            creep.say(emoji.TRUCK + targets[0].structureType);
            creep.moveTo(targets[0], {maxRooms: 1, range: 1});
        } else if (last_error != OK) {
            console.log(creep.name + ' at ' + creep.pos + ' transfer error: ' + util.error_name(last_error) +
                        ', target: ' + targets[0].pos + ', resource: ' + resource +
                        ', carrying: ' + (resource ? creep.carry[resource] : '(null)'));
        }
        return true;
    } else {
        return false;
    }
} // deliver_structure
// deliver_structure = profiler.registerFN(deliver_structure, 'creep.deliver_structure');

// We deliver energy to a container
// structs = an array of container structure types to deliver to
function deliver_storage_energy(creep, structs) {
    let targets = util.find_structures(creep.room,
        (structure) => {
            return structs.includes(structure.structureType) &&
                    structure.isActive() &&
                    // Structures are different: they have storage for each type of thing. store.energy
                    // is always defined, but the other types are only defined if they contain that item.
                   _.sum(structure.store) < structure.storeCapacity;
    });

    if (targets.length > 0) {
        // Pick closest target
        targets = util.sort_proximity(creep, targets);
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.say(emoji.TRUCK + targets[0].structureType);
            creep.moveTo(targets[0], {maxRooms: 1, range: 1});
        }
        return true;
    } else {
        return false;
    }
} // deliver_storage_energy
// deliver_storage_energy = profiler.registerFN(deliver_storage_energy, 'creep.deliver_storage_energy');

// Sends the creep to upgrade the room controller
function upgrade_room_controller(creep) {
    if (creep.carry.energy <= 0) {
        return false;
    }
    const result = creep.upgradeController(creep.room.controller);
    if (result == ERR_NOT_IN_RANGE) {
        const result = creep.moveTo(creep.room.controller, { range: 1, maxRooms: 1 });
        if (result != OK && result != ERR_TIRED) {
            console.log(creep.name, creep.pos, 'cannot move to controller:', creep.room.controller.pos, util.error_name(result));
        }
    } else if (result != OK) {
        console.log(creep.name, creep.pos, 'cannot upgrade controller:', util.error_name(result));
    } else if (result == OK) {
        // Continue to move toward it so it doesn't cause a jam far away
        if ((Game.time % 5) == 0) {
            const result = creep.moveTo(creep.room.controller, { range: 2, maxRooms: 1 });
            if (result != OK && result != ERR_NO_PATH && result != ERR_TIRED) {
                console.log(creep.name, creep.pos, 'cannot move closer to controller:', creep.room.controller.pos, util.error_name(result));
            }
        }
    }
} // upgrade_room_controller
// upgrade_room_controller = profiler.registerFN(upgrade_room_controller, 'creep.upgrade_room_controller');










// Build things. Returns true if it finds something to build,
// or false if out of energy or nothing to build (or some other error).
// proximity = defaults false, if true build closest thing
function build(creep, proximity = false) {

    if (creep.carry.energy <= 0) {
        console.log(creep.name, creep.pos, 'cannot build - out of energy', creep.carry.energy);
        return false;
    }

    let targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);

    if (targets.length <= 0) {
        // console.log(creep.name, 'cannot build - no construction sites');
        return false;
    }
    if (proximity) {
        targets = util.sort_proximity(creep, targets);
    }
    creep.say(emoji.BUILD + targets[0].structureType);

    const retval = creep.build(targets[0]);
    if (retval == ERR_NOT_IN_RANGE) {
        creep.moveTo(targets[0], {maxRooms: 1, range: 1});
    } else if (retval != OK) {
        console.log(creep.name, 'error building', targets[0].structureType, targets[0].pos,
                    'retval:', util.error_name(retval));
    }
    return retval == OK || retval == ERR_NOT_IN_RANGE;
} // build

// Repairs things in importance order.
// Returns true if it finds something to repair, otherwise false.
// THIS IS DEPRECATED: See Repair module and repairer2 role.
function repair(creep) {

    let rep;
    let structs = creep.room.find(FIND_STRUCTURES); // MY_STRUCTURES omits roads
    let s;
    // console.log('My structures: #' + structs.length);

    // Repair non-roads, non-walls
    /*
    for (let i = 0; i < structs.length; i++) {
        s = structs[i];
        // console.log(JSON.stringify(s));
        // Temporarily omit ramparts
        if (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_WALL ||
            s.structureType == STRUCTURE_CONTROLLER || s.structureType == STRUCTURE_RAMPART) { continue; }
        if (s.hits > s.hitsMax * 2 / 3) { continue; }
        rep = s; break;
    }
    */

    // Repair containers, ordered by most damaged
    if (rep == null) {
        let ss = _.filter(structs, (s) => { return s.structureType == STRUCTURE_CONTAINER &&
                                                   !repr.should_not_repair(s.pos) });
        ss = ss.sort((a,b) => { return (a.hits / a.hitsMax) - (b.hits / b.hitsMax); });
        for (let i = 0; i < ss.length; i++) {
            s = ss[i];
            if (s.hits > s.hitsMax * 2 / 3) { continue; }
            rep = s; break;
        }
    }

    // Repair roads, ordered by most damaged
    if (rep == null) {
        let roads = _.filter(structs, (s) => { return s.structureType == STRUCTURE_ROAD && !repr.should_not_repair(s.pos) });
        roads = roads.sort((a,b) => { return (a.hits / a.hitsMax) - (b.hits / b.hitsMax); });
        for (let i = 0; i < roads.length; i++) {
            s = roads[i];
            if (s.hits > s.hitsMax * 2 / 3) { continue; }
            rep = s; break;
        }
    }

    // Repair ramparts, ordered by most damaged
    if (rep == null) {
        let r = _.filter(structs, (s) => { return s.structureType == STRUCTURE_RAMPART && !repr.should_not_repair(s.pos) });
        r = r.sort((a,b) => { return (a.hits / a.hitsMax) - (b.hits / b.hitsMax); });
        for (let i = 0; i < r.length; i++) {
            s = r[i];
            if (s.hits > 200000) { continue; }
            rep = s; break;
        }
    }

    // Repair walls to 5,000 (for now)
    if (rep == null) {
        // console.log("No roads to repair");
        for (let i = 0; i < structs.length; i++) {
            s = structs[i];
            if (s.structureType != STRUCTURE_WALL) { continue; }
            if (s.hits > 51000) { continue; }
            if(repr.should_not_repair(s.pos)) { continue; }
            rep = s; break;
        }
    }

    if (rep != null) {
        let ret = creep.repair(rep);
        // console.log('Creep ' + creep.name + ' trying to repair ' + rep.structureType + ' at ' + JSON.stringify(rep.pos) + ', ret: ' + ret);
        if (ret == ERR_NOT_IN_RANGE) {
            creep.moveTo(rep, {maxRooms: 1, range: 1});
        }
        return true;
    }

    return false;
} // repair

// Gives a minimal set of repairs to ramparts after they're built.
// Returns false if we have no ramparts to build this way.
function repair_ramparts(creep) {
    // findClosestByPath is very expensive
    let rampart = creep.pos.findClosestByRange(FIND_STRUCTURES, { filter:
                      s => s.structureType == STRUCTURE_RAMPART && s.hits < 5100 && !repr.should_not_repair(s.pos) });
    if (rampart == null) {
        return false;
    }
    let ret = creep.repair(rampart);
    // console.log(creep.name, 'emergency repair', rampart.structureType, 'at',
    //             rampart.pos, 'ret:' + ret);
    if (ret == ERR_NOT_IN_RANGE) {
        creep.moveTo(rampart, {maxRooms: 1, range: 1});
    }
    creep.say(emoji.REPAIR + 'ramp');
    return true;
} // repair_ramparts


// Goes directly and naively to the destination room name.
function move_to_room_direct(creep, room_name) {
    const exit_dir = creep.room.findExitTo(room_name);
    const exit_pos = creep.pos.findClosestByRange(exit_dir);
    const retval = creep.moveTo(exit_pos);
    // console.log(creep.name + ' moving to room ' + room_name + ' via ' + exit_pos + ': ' + retval);
    creep.say(emoji.MOVE + room_name);
    return retval;
}

// Moves to another room safely, avoiding any red/red flagged rooms.
// Returns ERR_NO_PATH or other errors if it can't get there.
// TODO: Cache this path for multiple calls in the same tick, or even
// in global for longer (not too long in case we put new flags in).
function move_to_room_safe(creep, room_name) {
    const avoid_rooms = flag.get_flag_rooms(FLAG_COLOR_ROOM_AVOID, FLAG_SEC_ROOM_AVOID, false);

    if (avoid_rooms.includes(room_name)) {
        console.log('[WARNING]', creep.name, 'wants to move to avoid-room', room_name);
    }

    if (creep.room.name == room_name) {
        console.log('[WARNING]', creep.name, 'already in room it wants to move to', room_name);
        return OK;
    }

    // http://support.screeps.com/hc/en-us/articles/203079191-Map#findRoute

    const route = Game.map.findRoute(creep.room, room_name,
        { routeCallback: (rn, frn) => // room name, from room name
            {
                // Always make sure that you can go to the final room
                if (avoid_rooms.includes(rn) && rn != room_name) {
                    return Infinity;
                }
                // Prioritize going through my owned rooms
                let isMyRoom = Game.rooms[rn] && 
			                    Game.rooms[rn].controller && 
			                    Game.rooms[rn].controller.my;
			    return isMyRoom ? 1.0 : 2.5;
            }});

    if (route == null || _.isNumber(route) || route.length == 0) {
        console.log(creep.name, 'cannot find a path to room', room_name,
                    'from', creep.room.name, 'route:', route);
        console.log(new Error().stack);
        return ERR_NO_PATH;
    }

    // console.log(creep.name, 'going to', room_name, 'via', JSON.stringify(route));

    // const exit_dir = creep.room.findExitTo(room_name);
    const exit_pos = creep.pos.findClosestByRange(route[0].exit);
    const retval = creep.moveTo(exit_pos, {maxRooms: 1});
    creep.say(emoji.MOVE + room_name);
    return retval;
} // move_to_room_safe

// Sends the creep to the closest spawn to despawn.
// Returns true if we're moving there or despawning,
// or false if there is no spawn (!)
function despawn(creep) {
    const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn == null) {
        // Move to a room with a spawn
        if (creep.room.name != creep.memory.birth_room) {
            console.log(creep.name, 'Creep despawning to another room');
            return move_to_room_safe(creep, creep.memory.birth_room) == OK;
        }
        return false;
    }

    const result = spawn.recycleCreep(creep);
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, {maxRooms: 1, range: 1});
        console.log(creep.name + ': Moving to recycle');
    } else if (result == OK) {
        console.log(creep.name + ': Recycled');
    }
    return true;
} // despawn

// First dumps our stuff anywhere we can and then goes and despawns.
function dump_and_despawn(creep, override_structs = null) {
    const carry_energy = creep.carry.energy;
    const carry_minerals = _.sum(creep.carry) - carry_energy;
    const mineral_structs = [STRUCTURE_STORAGE,STRUCTURE_CONTAINER,STRUCTURE_TERMINAL];
    const energy_structs = [STRUCTURE_TOWER,STRUCTURE_LINK,STRUCTURE_EXTENSION,STRUCTURE_SPAWN];
    // STRUCTURE_LAB - limited

    if (carry_minerals > 0) {
        // Dump this to the closest one
        deliver_structure(creep, override_structs ? override_structs : mineral_structs, null);
    } else if (carry_energy > 0) {
        deliver_structure(creep, override_structs ? override_structs : energy_structs.concat(mineral_structs), null);
    } else {
        despawn(creep);
    }
} // dump_and_despawn()


module.exports = {

    // Creep main event loop handler
    harvest_or_act,

    // Individual things creeps could do
    reload_energy,
    harvest,
    deliver_structure,
    deliver_storage_energy,
    upgrade_room_controller,
    build,
    move_to_closest,
    pickup_at,
    pickup_adjacent,
    despawn,
    dump_and_despawn,
    move_to_room_direct,
    move_to_room_safe,
    repair_ramparts,
    pickup_ground_energy,
    clear_ground_energy_memory,
    retreat_from_enemies,
    load_resource,
    load_hostile_energy,
    hostile_energy_structures,

    // Deprecated
    repair,
};
