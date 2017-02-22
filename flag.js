// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Flag-related utility calls

"use strict";

const FLAG_COLOR_ROLE_DESIRED = COLOR_ORANGE;
const FLAG_SEC_ROLE_DESIRED = COLOR_ORANGE;

const FLAG_COLOR_RATCHET_STRUCT = COLOR_GREEN;
const FLAG_SEC_RATCHET_STRUCT = COLOR_YELLOW;

// Looks for flags with the specified
// colors, and returns their rooms as an array.
// Never returns null.
// Caches so you can call it a lot each tick.
// unique = if true, makes sure the room names are unique, but this
//          may also randomly reorder them
function get_flag_rooms(color, sec_color, unique = false) {

    const volatile_loc = ['get_flag_rooms', color + '-' + sec_color + (unique ? '-u' : '')]
    const cached = _.get(global.volatile, volatile_loc, null);

    if (cached != null) {
        return cached;
    }

    const flags =
        _.filter(Game.flags, f => f.color == color && f.secondaryColor == sec_color);
    let room_names = flags.map(f => f.pos.roomName);

    if (unique) {
        // console.log(color, sec_color, 'Flag rooms pre-unique:', JSON.stringify(room_names));
        room_names = Array.from(new Set(room_names));
        // console.log(color, sec_color, 'Flag rooms post-unique:', JSON.stringify(room_names));
    }

    // console.log(color, sec_color, 'Flag rooms:', JSON.stringify(room_names));

    // cache result for later
    _.set(global.volatile, volatile_loc, room_names);
    return room_names;
} // get_flag_rooms

// Gets all flag positions with the specified colors
function get_flag_poses(color, sec_color, unique = false) {

    const volatile_loc = ['get_flag_poses', color + '-' + sec_color + (unique ? '-u' : '')]
    const cached = _.get(global.volatile, volatile_loc, null);

    if (cached != null) {
        return cached;
    }

    const flags =
        _.filter(Game.flags, f => f.color == color && f.secondaryColor == sec_color);
    let poses = flags.map(f => f.pos);

    if (unique) {
        // console.log(color, sec_color, 'Flag rooms pre-unique:', JSON.stringify(room_names));
        poses = Array.from(new Set(poses));
        // console.log(color, sec_color, 'Flag rooms post-unique:', JSON.stringify(room_names));
    }

    // console.log(color, sec_color, 'Flag rooms:', JSON.stringify(room_names));

    // cache result for later
    _.set(global.volatile, volatile_loc, poses);
    return poses;
} // get_flag_poses


// Determines which room a multi-room creep should be assigned to.
// room_names - array of string room names we should consider
// func_needed - function that takes a string room name and tells us how many
//               creeps are needed for that room
// role - The name of the role we're looking at now
// room_memory_loc - The memory location in that creep's memory which includes it's
//                   room assignment (usually target_room)
// Returns null if we couldn't find an assignment.
function assign_room(room_names, func_needed, role, room_memory_loc) {

    if (room_names == null || room_names.length <= 0) {
        return null;
    }

    const creeps_needed = room_names.map(func_needed);
    // NOTE: The below is super inefficient
    const creeps_assigned = room_names.map(rhr => _.filter(Game.creeps, c => c.memory.role == role && c.memory[room_memory_loc] == rhr).length);
    // console.log(JSON.stringify(rhrs), JSON.stringify(rhrcn), JSON.stringify(carhr));
    let desired_room;
    const zipped = _.zip(room_names, creeps_needed, creeps_assigned);

    // Sort this by increasing percentage filled
    zipped.sort(([,an,aa],[,bn,ba]) => aa/an - ba/bn);

    // console.log(role, 'Zipped:', JSON.stringify(zipped));

    // Look for first under-assigned room
    for (const [rn, cn, ca] of zipped) {
        if (ca < cn) {
            desired_room = rn;
            // console.log(role, 'assigned to room', rn);
            break;
        }
    }

    // Now, check for oldest creep's room
    if (desired_room == null) {
        let oldest_creep = null;
        for (const creep of _.filter(Game.creeps, c => c.memory.role == role)) {
            if (oldest_creep == null) {
                oldest_creep = creep;
                continue;
            }
            if (oldest_creep.ticksToLive > creep.ticksToLive) {
                oldest_creep = creep;
            }
        }
        if (oldest_creep != null) {
            desired_room = oldest_creep.memory[room_memory_loc];
            // console.log(role, 'assigned to replace old creep in room', desired_room);
        }
    }

    // Shouldn't happen?
    if (desired_room == null) {
        console.log(role, 'cannot be assigned due to no room located');
    }

    return desired_room;
} // assign room

// Gets a flag that indicates how many creeps of a specified type
// are desired in a specified room, or null if no override.
// The flag is color X/X and the name must be
// <role_name>-<number_desired>-uniquestring (usually room name) and be located in
// the specified room.
// TODO: Cache this result in volatile.
function get_desired_override(room_name, role_name) {
    const flags =
        _.filter(Game.flags, f => f.color == FLAG_COLOR_ROLE_DESIRED && f.secondaryColor == FLAG_SEC_ROLE_DESIRED &&
                                  f.pos.roomName == room_name && f.name.startsWith(role_name + '-'));
        // _.filter(Game.flags, f => f.color == FLAG_COLOR_ROLE_DESIRED && f.secondaryColor == FLAG_SEC_ROLE_DESIRED);
        // _.filter(Game.flags, f => true);
        
    if (flags == null || flags.length <= 0) {
        // console.log('No flags found for room/role', room_name, role_name);
        return null;
    }
    if (flags.length > 1) {
        console.log('[WARNING] Multiple desired override flags for room/role', room_name, role_name, flags.length,
                    JSON.stringify(flags.map(f => f.name)));
    }
    
    const [,num,] = flags[0].name.split('-',3);
    
    // console.log('Override for room/role:', room_name, role_name, num);
    return num;
} // get_desired_override

// Gets a flag that indicates how high the specified structure
// should be ratcheted in this room,
// or null if no override.
// The flag is color X/X and the name must be
// <type>-<amount>-<uniquestring>
// in the specified room.
// TODO: Cache this result in volatile.
// FIXME: Combine with get_desired_override
function get_ratchet_struct(room_name, struct_name) {
    const flags =
        _.filter(Game.flags,
            f => f.color == FLAG_COLOR_RATCHET_STRUCT && f.secondaryColor == FLAG_SEC_RATCHET_STRUCT &&
                 f.pos.roomName == room_name && f.name.startsWith(struct_name + '-'));

    if (flags == null || flags.length <= 0) {
        // console.log('No flags found for room/struct', room_name, struct_name);
        return null;
    }
    if (flags.length > 1) {
        console.log('[WARNING] Multiple desired override flags for room/struct', room_name, struct_name, flags.length,
            JSON.stringify(flags.map(f => f.name)));
    }

    const [,num,] = flags[0].name.split('-',3);

    // console.log('Override for room/struct:', room_name, struct_name, num);
    return num;
} // get_ratchet_struct


module.exports = {
    get_flag_rooms,
    get_flag_poses,
    assign_room,
    get_desired_override,
    get_ratchet_struct,
};
