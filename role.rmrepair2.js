// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Remote repairer using flags.
//
// Finds all remote repair flags.
// Goes to one of them at random.
// Does all the building/repairing there.
// If done, goes to the next room with a remote repair flag.

// Memory locations
// target_room - which room we're repairing
// refill_room - which room we will get more energy from

"use strict";
const util = require('util');
const c = require('creep');
const repair = require('repair');
const repairer = require('role.repairer2');
const builder = require('role.builder');
const resources = require('resources');
const flag = require('flag');

const FLAG_COLOR_REMOTE_REPAIR = COLOR_YELLOW;
const FLAG_SEC_REMOTE_REPAIR = COLOR_GREEN;


// Looks for flags which tell me which rooms we should be harvesting.
function get_rooms_to_repair() {
    return flag.get_flag_rooms(FLAG_COLOR_REMOTE_REPAIR, FLAG_SEC_REMOTE_REPAIR, true);
} // get_rooms_to_repair

// Gets the next room we should be repairing.
// Call this only when we are changing rooms OR
// when we have no current target room.
// Returns false if we couldn't pick a room.
function pick_next_room(creep) {
    const current_target = creep.memory.target_room;
    const candidates = get_rooms_to_repair();
    let new_target;

    if (candidates == null || candidates.length == 0) {
        // Um... Now what?
        delete creep.memory.target_room;
        return false;
    }

    const current_index = candidates.indexOf(current_target);

    if (current_target == null || current_index < 0) {
        // We have no target, or our current target isn't in the list anymore.
        // TODO: Pick a target room from the available ones
        // which has something that needs to be built?
        // TODO: Pick a target at random?
        new_target = candidates[0];
    } else {
        // Pick the next target in the list of rooms.
        new_target = candidates[(current_index + 1) % candidates.length];
    }

    creep.memory.target_room = new_target;
    console.log(creep.name, 'now targeting room for remote build/repair', new_target);
    return true;
}



// We either build something, or try to repair something.
function act(creep) {
    const built = c.build(creep);

    if (built) {
        // If we're building, we're necessarily not repairing.
        repair.set_repairing(creep, null);
        return;
    }

    const repaired = repairer.repairer2_act(creep, true);

    if (repaired) {
        return;
    }

    // We neither built nor repaired, so go to the next room.
    const got_next_room = pick_next_room(creep);

    if (!got_next_room) {
        console.log(creep.name, 'could not find a room to build/repair, so harvesting');
        creep.memory.acting = false;
    }
} // act


// When we're done repairing, clear our repairing flag.
function start_harvesting(creep) {
    // Stop repairing whatever we were repairing
    repair.set_repairing(creep, null);

    // Find the closest room with storage (or anything else)
    let closest_room = util.find_closest_room(creep.room, FIND_SOURCES, [STRUCTURE_STORAGE]);

    if (closest_room == '') {
        // Didn't find any storages
        closest_room = util.find_closest_room(creep.room, FIND_SOURCES, [STRUCTURE_SPAWN]);
    }
    if (closest_room == null || closest_room == '') {
        // Should never happen
        console.log(creep.name, '[ERROR] should never happen');
        return;
    }

    console.log(creep.name, 'will collect energy from room', closest_room,
                'from current room', creep.room.name);
    creep.memory.refill_room = closest_room;
}

// When we're acting, we reset our refill room for later setting.
function start_acting(creep) {
    delete creep.memory.refill_room;
}


// What to do when we are retreating from enemies
function retreat(creep) {
    if (creep.memory.refill_room == null) {
        start_harvesting(creep);
    }
    c.move_to_room_safe(creep, creep.memory.refill_room);
}


function run(creep) {
    let go_to_room = null;

    creep.memory.multi_room = true;

    if (creep.spawning) {
        return;
    }

    if (creep.memory.target_room == null) {
        pick_next_room(creep);
        if (creep.memory.target_room == null) {
            console.log(creep.name, 'cannot pick any rooms for remote build/repair!');
            start_harvesting(creep); // Find closest refill room
            go_to_room = creep.memory.refill_room;
        }
    }

    // Get to the correct room.
    // console.log(creep.name, 'acting', creep.memory.acting, 'room', creep.room.name);
    if (go_to_room == null) {
        if (creep.memory.acting && creep.room.name != creep.memory.target_room) {
            // console.log(creep.name, "moving to room to repair:", ROOM_TO_REPAIR);
            go_to_room = creep.memory.target_room;
        } else if (!creep.memory.acting) {
            if (creep.memory.refill_room == null) {
                start_harvesting(creep);
            }
            if (creep.room_name != creep.memory.refill_room) {
                // console.log(creep.name, "moving to room to refill:", ROOM_TO_REFILL);
                go_to_room = creep.memory.refill_room;
            }
        }
    }
    if (go_to_room && go_to_room != creep.room.name) {
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
    c.retreat_from_enemies(creep, creep.memory.target_room, retreat) ||
        c.harvest_or_act(creep, builder.builder_harvest, act, start_harvesting, start_acting);
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
    const maxGroups = 8;
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

    get_rooms_to_repair,
};
