// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Repairers first try to repair things that need repair,
// in priority order, and otherwise will try to build things
// and finally try to upgrade room controllers.

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');

function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyAvail = ri.energy_avail;
    const energyCap = ri.energy_cap;

    return [CARRY, WORK, MOVE];
}

module.exports = {

    spawn_body,

    /** @param {Creep} creep **/
    run: function(creep) {

        if (creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.say('harvesting');
        }
        if (!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
            creep.memory.building = true;
            creep.say('repairing');
        }

        if (creep.memory.building) {
            // Repair, build, or upgrade
            if (c.repair(creep)) {
                creep.say('repair');
            } else if (c.build(creep)) {
                creep.say('build');
            } else if (c.upgrade_room_controller(creep)) {
                creep.say('upgrade');
            }
            // c.repair(creep) || c.build(creep) || c.upgrade_room_controller(creep);
            
        } else {
            // Try to get stuff from storage first, but if not,
            // then get it from our usual source
            if (!c.reload_energy(creep)) {
                c.harvest(creep);
            }
        }
    }
};
