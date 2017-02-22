// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// WEEKEND TODOS:
// 0. Towers to attack enemy creeps with most HEAL body parts first
// 0a. Spawn defenders in closest place to enemies (and other remote creeps to where needed)
// 1. Auto safe mode
// 2. Ranged defenders who go into ramparts when attacked
// 3. Remote repairers for the roads in W54S31
// 4. Have multi-room spawns spawn in closest room to destination
//    or the one with largest energy stored up


// Requirements ------------------------------------------------

"use strict";
// const profiler = require('screeps-profiler');
//
const util = require('util');
const mycpu = require('cpu');
const myspawn = require('spawn');
const myrepair = require('repair');
const mytower = require('tower');
const mylink = require('link');
const roles = require('roles');
const resources = require('resources');
const screepsplus = require('screepsplus');
const rratchet = require('repair.ratchet');
const pebble = require('pebble');
const safety = require('safety');
const e = require('events');

// Debugging - allow use of imports in console
global.cons = {};
global.cons.harvester2 = require('role.harvester2');
global.cons.link = mylink; // LinkModule2 (something suitably generic)
global.cons.resources = resources; // res2.analyze_room(Game.rooms[Object.keys(Game.rooms)[0]])
global.cons.spawn = myspawn;
global.cons.rr = rratchet;
global.cons.cbt = require('callback.test');
global.cons.mkt = require('market');
global.cons.flag = require('flag');
global.cons.util = util;
global.cons.role = roles;
global.cons.c = require('creep');

global.MY_USERNAME = 'Admiral';


// console.log('<font color="#7700FF" severity="1">Test color</font>');

// CONSTANTS ---------------------------------------------------

const DEBUG = false;



// TICK_INITIALIZE ------------------------------------------------

// All keys under global.volatile are erased every tick, so this
// can be used for a tick-shared cache.
// Global normally is constant for each backend tick-processor,
// except for the the fact that every now and then those tick-processors
// can apparently wipe the contents. So, it's useful for long-term
// caching values that don't change (or you can detect that
// they need to be recalculated).

function tick_init() {
    global.volatile = {};
    // Initialize our room summaries for later use
    resources.summarize_rooms();

    // Rotate memory stats
    Memory.stats_old = Memory.stats;
    Memory.stats = null;
} // tick_init



function log_info() {
    // Periodic logging of useful info
    if ((Game.time % 100) == 0) {
        // CPU: limit: 30, tickLimit: 500, bucket: 10000, used: 4.08803
        console.log("CPU: limit: " + Game.cpu.limit + ", tickLimit: " + Game.cpu.tickLimit +
                    ", bucket: " + Game.cpu.bucket + ", used: " + Game.cpu.getUsed());


        let cs = "Creeps: ";
        for (const r in global.role_info) {
            cs = cs + r + 's: ' + util.creeps_by_role(r).length + ', ';
        }
        console.log(cs);
    }

    mycpu.track();
} // log_info()


// Main game loop
function loop() {
    e.reset_events();
    tick_init();
    roles.init();
    rratchet.check_repair_ratchets();
    myrepair.init();

    myspawn.clear_memory();
    myspawn.emergency_spawn();
    myspawn.all_spawns();
    // myspawn.spawn(SPAWN1, global.role_info);

    roles.run_creeps_by_role();

    mylink.do_links();
    mytower.do_towers();

    if ((Game.time % 100) == 0) {
        myrepair.cross_check_memory();
    }

    // log_info();
    // console.log('Events:', JSON.stringify(e.get_events()));
    screepsplus.collect_stats();
    pebble.send_to_pebble();

    // safety.make_safe_costmatrix('W56S31');

    // Update our CPU as the absolute last thing we do.
    Memory.stats.cpu.used = Game.cpu.getUsed(); // AT END OF MAIN LOOP
} // loop


// profiler.enable();
module.exports = {
    loop, // : function() { profiler.wrap(loop); },
};
