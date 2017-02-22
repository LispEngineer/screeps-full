// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Determine the areas of a room that are safe.
// Safe is defined as "can get to this position from our spawn
// point without going through any ramparts."
"use strict";

const ROOM_SIZE = 50;

/** Things we ignore when going through a room
 *
 * @type {*[]}
 */
const LOOK_TYPES_IGNORED = [
    LOOK_CREEPS,
    LOOK_ENERGY,
    LOOK_RESOURCES,
    LOOK_FLAGS,
    LOOK_CONSTRUCTION_SITES,
    LOOK_NUKES,
    // These two things are embedded in walls
    LOOK_SOURCES,
    LOOK_MINERALS,
];

const COST_UNPASSABLE = 255;
const COST_PASSABLE = 1;

const LOC_WALL = '*';
const LOC_CWALL = 'x';
const LOC_STRUCTURE = 'o';
const LOC_RAMPART = '=';
const LOC_SAFE = ' ';
const LOC_UNSAFE = 'x';
const LOC_UNKNOWN = '?';

/** The cost associated with each terrain.
 * FIXME: I don't see where these types are programmatically defined
 * @type {{swamp: number, wall: number, plain: number}}
 */
const TERRAIN_COSTS = {
    swamp: COST_PASSABLE,
    plain: COST_PASSABLE,
    wall:  COST_UNPASSABLE,
};

// safety is an array[y][x] where we mark every point from the specified starting
// point that is unknown as passable. It's a recursive, dumb algorithm.
function floodfill(safety, starting_point) {
    for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) {
                // We skip our starting point
                continue;
            }
            const cx = x + starting_point.x;
            const cy = y + starting_point.y;
            if (safety[cy][cx] != LOC_UNKNOWN) {
                continue;
            }
            safety[cy][cx] = LOC_SAFE;
            floodfill(safety, { x: cx, y: cy });
        } // x
    } // y
} // floodfill

function make_safe_costmatrix(room_name) {

    // wrc = wall/rampart costs
    const wrc = new PathFinder.CostMatrix();
    const room = Game.rooms[room_name];
    const everything = room.lookAtArea(0, 0, ROOM_SIZE, ROOM_SIZE, true);
    const spawns = [];
    // A [y][x]-indexed array of LOC_*
    const safety = [];

    // Initialize our safety matrix
    for (let y = 0; y < ROOM_SIZE; y++) {
        safety[y] = [];
        for (let x = 0; x < ROOM_SIZE; x++) {
            safety[y][x] = LOC_UNKNOWN;
        }
    }

    for (const t of everything) {
        let item_cost;

        if (LOOK_TYPES_IGNORED.includes(t.type)) {
            continue;
        }

        if (t.type == LOOK_TERRAIN) {
            item_cost = TERRAIN_COSTS[t.terrain];

            if (t.terrain == 'wall') {
                safety[t.y][t.x] = LOC_WALL;
            }

        } else if (t.type == LOOK_STRUCTURES) {
            if (OBSTACLE_OBJECT_TYPES.includes(t.structure.structureType)) {
                if (t.structure.structureType == STRUCTURE_WALL) {
                    safety[t.y][t.x] = LOC_CWALL;
                } else {
                    safety[t.y][t.x] = LOC_STRUCTURE;
                }
                item_cost = COST_UNPASSABLE;
            } else if (t.structure.structureType == STRUCTURE_RAMPART) {
                // We consider ramparts as almost unpassable for this analysis
                item_cost = COST_UNPASSABLE;
                safety[t.y][t.x] = LOC_RAMPART;
            } else {
                item_cost = COST_PASSABLE;
            }
            if (t.structure.structureType == STRUCTURE_SPAWN) {
                // Save our spawns for later
                spawns.push(t.structure);
            }

        } else {
            console.log('Warning: Unknown LOOK_* type:', t.type);
            continue;
        }

        if (item_cost == null) {
            console.log('Unknown cost room lookAt item:', JSON.stringify(t));
            continue;
        }

        const old_cost = wrc.get(t.x, t.y);
        if (old_cost < item_cost) {
            wrc.set(t.x, t.y, item_cost);
        }

    } // everything

    const ffsafety = _.cloneDeep(safety);

    const cpu1 = Game.cpu.getUsed();

    // Now, go through and search every possible spot
    for (let y = 0; y < ROOM_SIZE; y++) {
        for (let x = 0; x < ROOM_SIZE; x++) {

            if (safety[y][x] != LOC_UNKNOWN) {
                // Previously figured this one out
                continue;
            }
            const rp = room.getPositionAt(x, y);
            let can_get_to_spawn = false;

            // We're in a safe spot if we can get to any of our spawns
            // without passing through any ramparts.
            for (const s of spawns) {
                let pfr =
                    PathFinder.search(rp, { pos: s.pos, range: 1 },
                                      { roomCallback: rn => wrc,
                                        swampCost: 1,
                                        plainCost: 1,
                                        maxRooms: 1,
                                        maxCost: 200 });
                can_get_to_spawn = !pfr.incomplete;
                if (can_get_to_spawn) {
                    break;
                }
            } // all spawns

            if (can_get_to_spawn) {
                // Couldn't find a path, so we're not in a safe spot
                safety[y][x] = LOC_SAFE;
            } else {
                safety[y][x] = LOC_UNSAFE;
            }
        } // x
    } // y

    // wrc.set(1,1,1);
    // console.log(JSON.stringify(wrc));
    // console.log(JSON.stringify(everything,null,2));

    const cpu2 = Game.cpu.getUsed();


    // Calculate the safety/unsafety via floodfill
    for (const s of spawns) {
        floodfill(ffsafety, s.pos);
    }
    for (let y = 0; y < ROOM_SIZE; y++) {
        for (let x = 0; x < ROOM_SIZE; x++) {
            if (ffsafety[y][x] == LOC_UNKNOWN) {
                ffsafety[y][x] = LOC_UNSAFE;
            }
        }
    }

    const cpu3 = Game.cpu.getUsed();

    console.log(room_name, 'safety matrix');
    for (let y = 0; y < ROOM_SIZE; y++) {
        console.log(safety[y].join(''));
    }
    console.log(room_name, 'FLOODFILL safety matrix');
    for (let y = 0; y < ROOM_SIZE; y++) {
        console.log(ffsafety[y].join(''));
    }

    console.log('CPU used for Pathfinder alg:', cpu2 - cpu1);
    console.log('CPU used for FloodFill alg:', cpu3 - cpu2);

} // make_safety_costmatrix


module.exports = {
    make_safe_costmatrix,
};
