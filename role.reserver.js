// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const util = require('util');
const emoji = require('emoji');
const resources = require('resources');
const flag = require('flag');
const c = require('creep');

const THIS_ROLE = 'reserver';

// Memory:
// FIXME: Change this to target_room
// claim_room - which room this creep should go to and reserve


const ROOM_TO_RESERVE = 'W54S31';

const FLAG_COLOR_RESERVE = COLOR_YELLOW;
const FLAG_SEC_RESERVE = COLOR_RED;

// Do not send two claimers to a room that can fit only one.
// cons.util.free_adjacent(Game.rooms['W54S32'].controller);



// Looks for flags which tell me which rooms we should be harvesting.
function get_rooms_to_reserve() {
    return flag.get_flag_rooms(FLAG_COLOR_RESERVE, FLAG_SEC_RESERVE, true);
} // get_rooms_to_repair


// Tells us what room this creep should be assigned to.
// We loop through each room, and see if the correct
// number of creeps are assigned to each room, and once
// we find one with too few, we assign to there. If all
// assigned, then we assign to the oldest creep with our role.
function get_room_assignment() {
    let desired_room = flag.assign_room(get_rooms_to_reserve(), num_desired_for_room,
                                        THIS_ROLE, 'claim_room');

    if (desired_room == null) {
        console.log('reserver could not find a room to assign!');
        desired_room = ROOM_TO_RESERVE;
    }

    return desired_room;
}



// Sets up stuff about us when we're created
function initialize(creep) {
    if (creep.memory.initialized) {
        return;
    }

    creep.memory.home_room = creep.pos.roomName;
    creep.memory.claim_room = get_room_assignment();
    creep.memory.claiming = false;
    creep.memory.initialized = true;
    console.log(creep.name, 'initialized and assigned to room', creep.memory.claim_room);
}

function reserve(creep) {
    const room = creep.memory.claim_room;

    creep.memory.multi_room = true;

    if (creep.pos.roomName != room) {
        c.move_to_room_safe(creep, room);
        return;
    }

    // We're in the right room.
    if (!util.is_room_claimed(room)) {
        const success = creep.reserveController(creep.room.controller);
        if (success == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { maxRooms: 1 });
            creep.say(emoji.MOVE + 'controller');
        } else if (success == OK) {
            creep.say('reserving');
        } else {
            console.log(creep.name + ' reserving: ' + success);
        }
    }
}


// What to do when we are retreating from enemies
function retreat(creep) {
    c.move_to_room_safe(creep, creep.memory.birth_room);
}



function run(creep) {
    if (creep.spawning) {
        return;
    }
    initialize(creep);

    if (creep.memory.claim_room != null) {
        c.retreat_from_enemies(creep, creep.memory.claim_room, retreat) ||
            reserve(creep);
    } else {
        console.log(creep.name, 'Reserver needs a room to reserve.');
    }
} //  harvester_action_run


// Use a "hold" body (small one) if our ticks to end are high.
// Otherwise use a large one to increase our ticks to end.
// We really need to know what room the creep would be assigned
// to to calculate this.
function spawn_body(room_ignored) {
    const small = [MOVE, CLAIM];
    const large = [MOVE, MOVE, CLAIM, CLAIM];

    // Which room will we assign the next creep to?
    // FIXME: This is a total hack
    const next_room = get_room_assignment();

    if (next_room == null) {
        return small;
    }
    
    const rr = Game.rooms[next_room];
    
    if (rr == null) {
        return small;
    }
    if (rr.controller == null) {
        return small;
    }
    if (rr.controller.my || rr.controller.level > 0) {
        return small;
    }
    if (rr.controller.reservation == null) {
        return large;
    }
    if (rr.controller.reservation.username != global.MY_USERNAME) {
        // Shit, someone else reserved it. Should we have our own claimers?
        return small;
    }
    if (rr.controller.reservation.ticksToEnd > 4750) {
        return small;
    }
    return large;
} // spawn_body




// How many of these guys are desired in the specified room?
// 1 if we can't see the room
// 2 if it has at least two free adjacent spots and low reservation count
// 1 otherwise
function num_desired_for_room(room_name) {
    if (room_name == null) {
        return 0;
    }
    
    const rr = Game.rooms[room_name];

    if (rr != null) {
        if (rr.controller == null) {
            return 0;
        }
        const adjacent = util.free_adjacent(rr.controller);
        if (rr.controller.my) {
            return 0;
        }
        if (rr.controller.level > 0) {
            // Someone else controls it
            return 0;
        }
        if (rr.controller.reservation == null) {
            return adjacent > 1 ? 2 : 1;
        }
        if (rr.controller.reservation.username != global.MY_USERNAME) {
            // Shit, someone else reserved it. Should we have our own claimers?
            return 1;
        }
        if (rr.controller.reservation.ticksToEnd < 4500) {
            return adjacent > 1 ? 2 : 1;
        }
        return 1;
    }
    // If we have no visibility into the room, then just one?
    return 1;
} // num_desired_for_room

// Returns the number of desired reservers
// for all rooms with reservation flags
function num_desired(room_ignored) {
    const rrns = get_rooms_to_reserve(); // reserve room names

    if (rrns == null || rrns.length == 0) {
        return 0;
    }

    const needed = _.sum(rrns.map(num_desired_for_room));

    // console.log('reservers needed', rrns, needed);

    return needed;
} // num_desired

module.exports = {
    run,
    spawn_body,
    num_desired,
};
