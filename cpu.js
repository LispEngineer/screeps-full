// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// CPU handling code

"use strict";

// TODO: Make the absolute last thing this does is save the total CPU
// usage to Memory, and then we also save what we used in our earlier
// calculation, and we reverse it with the correct CPU.

module.exports = {
    
    // Tracks our CPU usage and logs about it from time to time.
    // This should be the absolute last thing called per tick.
    track: function () {
    
        // Initialize our memory "cpuTrack" if we haven't used it yet   
        if (Memory.cpuTrack == null) {
            Memory.cpuTrack = {};
            Memory.cpuTrack.ticks = 0;
            Memory.cpuTrack.min_used = Number.MAX_VALUE;
            Memory.cpuTrack.max_used = 0;
            Memory.cpuTrack.total_used = 0;
        }
        
        let ticks = parseInt(Memory.cpuTrack.ticks);
        let min_used = parseFloat(Memory.cpuTrack.min_used);
        let max_used = parseFloat(Memory.cpuTrack.max_used);
        let total_used = parseFloat(Memory.cpuTrack.total_used);
        let used = Game.cpu.getUsed();
        
        if ((Game.time % 100) == 0) {
            // Calculate our data and log it
            console.log("CPU summary: ticks: " + ticks +
                        ", min_used: " + min_used.toFixed(2) +
                        ", max_used: " + max_used.toFixed(2) +
                        ", total_used: " + total_used.toFixed(2) +
                        ", avg_used: " + (total_used / ticks).toFixed(2) +
                        ", used_now: " + used.toFixed(2));
            
            // Reset our data
            ticks = 0;
            min_used = Number.MAX_VALUE;
            max_used = 0;
            total_used = 0;
        }
        
        ticks++;
        if (min_used > used) {
            min_used = used;
        }
        if (max_used < used) {
            max_used = used;
        }
        total_used += used;
        Memory.cpuTrack.ticks = ticks;
        Memory.cpuTrack.min_used = min_used;
        Memory.cpuTrack.max_used = max_used;
        Memory.cpuTrack.total_used = total_used;
    }, // track_cpu


};
