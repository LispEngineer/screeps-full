// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const flag = require('flag');

const FLAG_COLOR_IGNORE_SOURCE = COLOR_BROWN;
const FLAG_SEC_IGNORE_SOURCE = COLOR_BROWN;



function error_name(e) {
    switch (e) {
        case OK: return 'OK';
        case ERR_NOT_OWNER: return 'ERR_NOT_OWNER';
        case ERR_NO_PATH: return 'ERR_NO_PATH';
        case ERR_NAME_EXISTS: return 'ERR_NAME_EXISTS';
        case ERR_BUSY: return 'ERR_BUSY';
        case ERR_NOT_FOUND: return 'ERR_NOT_FOUND';
        case ERR_NOT_ENOUGH_ENERGY: return 'ERR_NOT_ENOUGH_XXX'; // Resources, extensions
        case ERR_INVALID_TARGET: return 'ERR_INVALID_TARGET';
        case ERR_FULL: return 'ERR_FULL';
        case ERR_NOT_IN_RANGE: return 'ERR_NOT_IN_RANGE';
        case ERR_INVALID_ARGS: return 'ERR_INVALID_ARGS';
        case ERR_TIRED: return 'ERR_TIRED';
        case ERR_NO_BODYPART: return 'ERR_NO_BODYPART';
        case ERR_RCL_NOT_ENOUGH: return 'ERR_RCL_NOT_ENOUGH';
        case ERR_GCL_NOT_ENOUGH: return 'ERR_GCL_NOT_ENOUGH';
        default: '(err ' + e + ')';
    }
}

// Loads all structures from all rooms we see, and returns them.
// Caches them in case we call multiple times.
// TODO: Allow the caller to send a filter in.
function all_structures() {
    const cached = global.volatile.dpf_all_structures;
    if (cached != null) {
        // console.log('Returning cached structure list');
        return cached;
    }

    // Find all the rooms that I have structures in all rooms and put into a gigantic list
    let structs = [];

    // for x in y = give keys; for x of y = give values
    // Unfortunately, Game.rooms doesn't support the "of" construct, so...
    for (const r_name in Game.rooms) {
        const r = Game.rooms[r_name];
        const rs = r.find(FIND_STRUCTURES); // MY_STRUCTURES omits roads, walls, etc.
        // console.log('Found ' + rs.length + ' structures in room ' + r.name);
        structs = structs.concat(rs);
    }
    global.volatile.dpf_all_structures = structs;

    return structs;
} // all_structures

function pos_eq(pa, pb) {
    return pa.x == pb.x && pa.y == pb.y && pa.roomName == pb.roomName;
}

// Finds the sources for the specified room - caches results
// Also, doesn't return sources with flagged positions
function find_sources(rm) {
    if (rm == null) {
        return [];
    }

    if (global.volatile.find_sources == null) {
        global.volatile.find_sources = {};
    }
    const cached = global.volatile.find_sources[rm.name];
    if (cached != null) {
        // console.log('Returning cached find_sources(' + rm.name + ')');
        return cached;
    }

    const flagged_sources = flag.get_flag_poses(FLAG_COLOR_IGNORE_SOURCE, FLAG_SEC_IGNORE_SOURCE);
    const retval = rm.find(FIND_SOURCES, { filter: s => !_.some(flagged_sources, fs => pos_eq(fs, s.pos)) });
    // console.log('Flagged sources:', flagged_sources, 'retval:', retval.map(s => s.pos));
    global.volatile.find_sources[rm.name] = retval;
    return retval;
} // find_sources

// Finds the structures for the specified room - caches results
// Returns only the ones matching filter.
function find_structures(rm, filt) {
    if (rm == null) {
        return [];
    }

    // Set up our cache if needed
    if (global.volatile.find_structs == null) {
        global.volatile.find_structs = {};
    }

    let cached = global.volatile.find_structs[rm.name];

    if (cached == null) {
        // Load our cache
        cached = all_structures();
        cached = _.filter(cached, (st) => { return st.pos.roomName == rm.name; });
        global.volatile.find_structs[rm.name] = cached;
    }

    // Filter our return value
    return filt == null ? cached : _.filter(cached, filt);
}


// Sorts an array of objects of type RoomObject (with .pos)
// by proximity to this creep (or RoomObject). Closest ones first.
function sort_proximity(c, ros) {
    const cr = c.pos.roomName;
    const cx = c.pos.x;
    const cy = c.pos.y;
    // We compare the squares of the distances, which is adequate
    return ros.sort(function(a, b) {
        // b's closer if we're not in a's room
        if (a.pos.roomName != cr) { return 1; };
        // a's closer if we're not in b's room
        if (b.pos.roomName != cr) { return -1; };
        const dax = cx - a.pos.x;
        const day = cy - a.pos.y;
        const dbx = cx - b.pos.x;
        const dby = cy - b.pos.y;
        return (dax * dax + day * day) - (dbx * dbx + dby * dby);
    });
} // sort_proximity


// Takes the specified object, and returns it's ID
// modulo a specified number. Only the least significant
// bits of the HEX-STRING ID are used to calculate this.
function id_mod(o, m) {
    const max_len = 8;

    if (o == null || o.id == null) {
        // This really shouldn't happen
        return 0;
    }

    const i2 = o.id.substr(o.id.length - max_len); // The last digit isn't very random. Usually even.
    const i = o.id.substr(-8).substr(0, 7);
    const retval = parseInt(i, 16) % m;

    // console.log("id_mod: " + m + ", id: " + o.id + ", short: " + i + ", retval: " + retval);
    return retval;
}

// Returns all creeps with the specified role
function creeps_by_role(role, room = null) {
    return _.filter(Game.creeps,
        creep => creep.memory.role == role &&
        (room == null ||
        (creep.pos.roomName == room ||
        creep.room == room)));
}

// Returns the result (name/error #), but does all logging, etc.
function create_creep(spawn, body, cname, role, birth_room = null) {
    if (birth_room == null) {
        if (Game.spawns[spawn] == null) {
            console.log('Spawn is null? ' + spawn);
            return ERR_INVALID_ARGS;
        }
        birth_room = Game.spawns[spawn].room.name;
    }

    // http://support.screeps.com/hc/en-us/articles/205990342-StructureSpawn#createCreep
    const newName = Game.spawns[spawn].createCreep(body, cname, { role: role, birth_room: birth_room, spawned_by: spawn });

    if (_.isString(newName)) {
        // console.log('Spawning new creep with role "' + role + '": ' + newName);
    } else if (newName == ERR_BUSY) {
        // Do nothing
    } else if (newName == ERR_NOT_ENOUGH_ENERGY) {
        // Do nothing
    } else if (newName == ERR_INVALID_ARGS) {
        console.log("Error spawning creep: invalid args: " + role + ', cname: ' + cname + ', body ' + body);
    } else if (newName == ERR_RCL_NOT_ENOUGH) {
        console.log("Error spawning creep: RoomController level too low: " + role);
    } else if (newName == ERR_NOT_OWNER) {
        console.log("Error spawning creep: Spawn not owned: " + spawn);
    } else if (newName == ERR_NAME_EXISTS) {
        console.log("Error spawning creep: Creep name duplicated: " + cname);
    }

    return newName;
} // create_creep



function is_room_claimed(roomName) {
    const room = Game.rooms[roomName];

    if (room == null) {
        return false;
    }

    return room.controller && room.controller.my;
}


// Tells us how many adjacent spots can be walked on.
// FROM dormando (with changes)
// source - a RoomObject (something with pos & room)
function free_adjacent(source) {
    const sPos = source.pos;
    const cache_loc = [free_adjacent, sPos.roomName, '' + sPos.x, '' + sPos.y];
    const cache = _.get(global, cache_loc, null);

    if (cache != null) {
        return cache;
    }

    const spots = source.room.lookForAtArea(LOOK_TERRAIN, sPos.y-1, sPos.x-1, sPos.y+1, sPos.x+1, true);
    let avail = 0;
    _.forEach(spots, spot => {
        if (spot.x === sPos.x && spot.y === sPos.y) return;
        if (spot.terrain !== "wall") avail++; // FIXME: Magic word
    });

    _.set(global, cache_loc, avail);
    return avail;
}

// Finds the closest owned room to the specified room.
// Brute force search: looks from the specified structure
// types in the source room to the specified structure types
// in the owned rooms.
// Returns null if from_room is not visible.
// Returns '' if no rooms have the specified structure types.
// Otherwise, returns the room name
//
// FIXME: Memoize this function as it's extremely expensive
function find_closest_room(from_room, from_find, dest_struct_types) {
    const MAX_OPS = 6000; // At default 2000, we sometimes have problems.
    /*
     Incomplete path [room W53S31 pos 22,21] to [room W54S31 pos 23,46] cost 164 ops 2000 last path pos [room W54S31 pos 2,25]
     Incomplete path [room W53S31 pos 22,21] to [room W55S31 pos 25,9] cost 142 ops 2000 last path pos [room W55S30 pos 31,46]
     Path from [room W53S31 pos 22,21] to [room W56S31 pos 34,9] costs 192
     Closest from W53S31 105 to ["storage"] is 192 from [room W53S31 pos 22,21] to [room W56S31 pos 34,9]
     rmha-0509 will return harvested energy to room W56S31 from room W53S31
     */

    if (_.isString(from_room)) {
        from_room = Game.rooms[from_room];
    }
    if (from_room == null) {
        return null;
    }

    const dest_rooms = _.filter(Game.rooms, r => r.controller && r.controller.my);
    const dest_room_names = dest_rooms.map(r => r.name);
    const dest_structs = _.filter(all_structures(),
        s => dest_room_names.includes(s.room.name) &&
             dest_struct_types.includes(s.structureType) &&
             (typeof s.my === 'undefined' || s.my));

    if (dest_structs == null || dest_structs.length <= 0) {
        return '';
    }

    const from_origins = from_room.find(from_find);

    // TODO: Add in the avoid rooms
    // const avoid_rooms = flag.get_flag_rooms(FLAG_COLOR_ROOM_AVOID, FLAG_SEC_ROOM_AVOID, false);

    let closest_dest;
    let closest_from;
    let closest_len = Infinity;
    let total_ops = 0.0;

    /* Example output:
     Path from [room W53S31 pos 22,21] to [room W54S31 pos 23,46] costs 229 ops 4002
     Path from [room W53S31 pos 22,21] to [room W55S31 pos 25,9] costs 183 ops 2016
     Path from [room W53S31 pos 22,21] to [room W56S31 pos 34,9] costs 192 ops 1161
     Closest from W53S31 105 to ["storage"] is 183 from [room W53S31 pos 22,21] to [room W55S31 pos 25,9] search ops 7179
     rmha-0545 will return harvested energy to room W55S31 from room W53S31
     */

    for (const fs of from_origins) {
        for (const ds of dest_structs) {
            // TODO: Try this with a swamp cost of 1, or with roads put into the cost matrix.
            // Cause it doesn't seem to make so much sense about the result above.
            const path_found = PathFinder.search(fs.pos, { pos: ds.pos, range: 1 },
                                                 { maxOps: MAX_OPS });
            if (path_found == null) {
                console.log('NULL path', fs.pos, 'to', ds.pos);
                continue;
            }
            total_ops += path_found.ops;
            if (path_found.incomplete) {
                console.log('Incomplete path', fs.pos, 'to', ds.pos, 'cost',
                            path_found.cost, 'ops', path_found.ops,
                            'last path pos', path_found.path[path_found.path.length - 1]);
                continue;
            }
            console.log('Path from', fs.pos, 'to', ds.pos, 'costs', path_found.cost,
                        'ops', path_found.ops);
            if (closest_len > path_found.cost) {
                closest_len = path_found.cost;
                closest_dest = ds;
                closest_from = fs;
            }
        }
    }

    if (closest_len < Infinity) {
        console.log('Closest from', from_room.name, from_find,
                    'to', JSON.stringify(dest_struct_types),
                    'is', closest_len, 'from', closest_from.pos, 'to', closest_dest.pos,
                    'search ops', total_ops);
    } else {
        console.log('Closest from', from_room.name, from_find,
            'to', JSON.stringify(dest_struct_types), 'was not found');
    }

    return closest_dest.room.name;
} // find_closest_room


module.exports = {

    all_structures,
    find_sources,
    find_structures,
    sort_proximity,

    id_mod,
    creeps_by_role,
    create_creep,

    is_room_claimed,

    free_adjacent,

    find_closest_room,

    error_name,
};
