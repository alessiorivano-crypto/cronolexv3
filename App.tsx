import React, { useState, useEffect, useRef } from 'react';
import type { Athlete, Lap } from './types';
import AthleteStopwatch from './components/AthleteStopwatch';
import AthleteComparisonTable from './components/AthleteComparisonTable';
import OverallComparisonTable from './components/OverallComparisonTable';
import { parseTime, formatTime } from './utils/formatters';
import { PrintIcon } from './components/icons/PrintIcon';
import { DownloadIcon } from './components/icons/DownloadIcon';

const calculateNextLap = (athlete: Athlete, currentTime: number): { laps: Lap[] } => {
    const lastLap = athlete.laps.length > 0 ? athlete.laps[athlete.laps.length - 1] : null;
    const lastLapDistance = lastLap ? lastLap.totalDistance : 0;
    
    // If the race is already finished (in distance mode), don't add another lap.
    if (athlete.targetDistance > 0 && lastLapDistance >= athlete.targetDistance) {
      return { laps: athlete.laps };
    }

    const lapNumber = athlete.laps.length + 1;
    let newTotalDistance = 0;

    // Distance Mode: calculate distance based on lapDistance and targetDistance
    if (athlete.targetDistance > 0) {
        newTotalDistance = lastLapDistance + athlete.lapDistance;
        if (lastLapDistance < athlete.targetDistance && newTotalDistance >= athlete.targetDistance) {
             // This is the final lap, snap to target distance
             newTotalDistance = athlete.targetDistance;
        }
    } 
    // Simple Mode: newTotalDistance remains 0
    
    const newLap: Lap = {
      lapNumber,
      totalTime: currentTime,
      totalDistance: newTotalDistance,
      timestamp: Date.now(),
    };
    
    return { laps: [...athlete.laps, newLap] };
};


const App: React.FC = () => {
  const [athletes, setAthletes] = useState<Athlete[]>(() => {
    try {
      const savedAthletes = localStorage.getItem('trackTimerAthletes');
      if (savedAthletes) {
        const parsedAthletes: Athlete[] = JSON.parse(savedAthletes);
        // Ensure timers are stopped on reload to prevent inconsistencies
        return parsedAthletes.map(athlete => ({
            ...athlete,
            isRunning: false,
            startTime: null,
            // Add lapDistance with a default for old data structures
            lapDistance: athlete.lapDistance || 400,
            // Add timestamp with a default for old data structures
            laps: (athlete.laps || []).map(lap => ({ ...lap, timestamp: lap.timestamp || 0 })),
        }));
      }
    } catch (error) {
        console.error("Failed to load athletes from local storage", error);
    }
    return [];
  });
  
  const [newAthleteName, setNewAthleteName] = useState<string>('');
  const [newAthleteTargetDistance, setNewAthleteTargetDistance] = useState<string>('');
  const [newAthleteLapDistance, setNewAthleteLapDistance] = useState<string>('400');
  const [newAthleteTargetTime, setNewAthleteTargetTime] = useState<string>('');
  const [newAthletePbTime, setNewAthletePbTime] = useState<string>('');
  const [editingAthleteId, setEditingAthleteId] = useState<number | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const nextId = useRef(athletes.length > 0 ? Math.max(...athletes.map(a => a.id)) + 1 : 0);
  const animationFrameId = useRef<number | undefined>(undefined);

  const lapDistancePresets = [100, 200, 400, 800, 1000];

  useEffect(() => {
    const updateTimers = () => {
      setAthletes(prevAthletes =>
        prevAthletes.map(athlete => {
          if (athlete.isRunning && athlete.startTime) {
            return { ...athlete, time: Date.now() - athlete.startTime };
          }
          return athlete;
        })
      );
      animationFrameId.current = requestAnimationFrame(updateTimers);
    };

    animationFrameId.current = requestAnimationFrame(updateTimers);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Save state to local storage whenever athletes change
  useEffect(() => {
    try {
      localStorage.setItem('trackTimerAthletes', JSON.stringify(athletes));
    } catch (error) {
      console.error("Failed to save athletes to local storage", error);
    }
  }, [athletes]);


  const handleAddAthlete = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAthleteName.trim()) {
      const newAthlete: Athlete = {
        id: nextId.current++,
        name: newAthleteName.trim(),
        startTime: null,
        time: 0,
        laps: [],
        isRunning: false,
        targetDistance: parseInt(newAthleteTargetDistance, 10) || 0,
        lapDistance: parseInt(newAthleteLapDistance, 10) || 400,
        targetTime: parseTime(newAthleteTargetTime),
        pbDistance: parseInt(newAthleteTargetDistance, 10) || 0, // PB distance uses target distance
        pbTime: parseTime(newAthletePbTime),
      };
      setAthletes(prev => [...prev, newAthlete]);
      setNewAthleteName('');
      setNewAthleteTargetDistance('');
      setNewAthleteLapDistance('400');
      setNewAthleteTargetTime('');
      setNewAthletePbTime('');
    }
  };

  const handleRemoveAthlete = (id: number) => {
    setAthletes(prev => prev.filter(athlete => athlete.id !== id));
  };
  
  const handleStartStop = (id: number) => {
    setAthletes(prevAthletes =>
      prevAthletes.map(athlete => {
        if (athlete.id === id) {
          if (athlete.isRunning) {
            // Athlete is running, so we're pausing. Add a final lap if needed.
            const { laps } = calculateNextLap(athlete, athlete.time);
            return { 
              ...athlete,
              laps,
              isRunning: false, 
              startTime: null,
            };
          } else {
            // Athlete is stopped, so we're starting.
            return { ...athlete, isRunning: true, startTime: Date.now() - athlete.time };
          }
        }
        return athlete;
      })
    );
  };

  const handleLap = (id: number) => {
    setAthletes(prevAthletes =>
      prevAthletes.map(athlete => {
        if (athlete.id === id && athlete.isRunning) {
          const { laps } = calculateNextLap(athlete, athlete.time);
          return { ...athlete, laps };
        }
        return athlete;
      })
    );
  };
  
  const handleReset = (id: number) => {
    setAthletes(prevAthletes =>
      prevAthletes.map(athlete => {
        if (athlete.id === id) {
          return { ...athlete, time: 0, laps: [], isRunning: false, startTime: null };
        }
        return athlete;
      })
    );
  };

  const handleUpdateAthlete = (id: number, updatedData: { name: string; targetDistance: number; targetTime: number; pbTime: number; lapDistance: number; }) => {
    setAthletes(prev =>
        prev.map(athlete => {
            if (athlete.id === id) {
                return {
                    ...athlete,
                    name: updatedData.name,
                    targetDistance: updatedData.targetDistance,
                    targetTime: updatedData.targetTime,
                    // PB distance is tied to target distance
                    pbDistance: updatedData.targetDistance,
                    pbTime: updatedData.pbTime,
                    lapDistance: updatedData.lapDistance,
                };
            }
            return athlete;
        })
    );
    setEditingAthleteId(null);
  };
  
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    let content = 'Track Timer Pro Results\n';
    content += `Export Date: ${new Date().toLocaleString()}\n`;

    const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
    // Set end of day for end date to include all of that day
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

    let hasData = false;

    athletes.forEach(athlete => {
      const lapsInRange = athlete.laps.filter(lap => {
        const lapTimestamp = lap.timestamp || 0;
        return lapTimestamp >= start && lapTimestamp <= end;
      });

      if (lapsInRange.length === 0) return;
      
      hasData = true;

      content += `\n========================================\n`;
      content += `Athlete: ${athlete.name}\n`;
      if (athlete.targetDistance > 0 && athlete.targetTime > 0) {
        content += `Target: ${athlete.targetDistance}m in ${formatTime(athlete.targetTime)}\n`;
      }
      if (athlete.pbDistance > 0 && athlete.pbTime > 0) {
        content += `PB: ${athlete.pbDistance}m in ${formatTime(athlete.pbTime)}\n`;
      }
      content += `----------------------------------------\n`;
      content += 'Lap\tDist (m)\tLap Time\tTotal Time\tTimestamp\n';
      content += `----------------------------------------\n`;

      lapsInRange.forEach((lap) => {
        const originalLapIndex = athlete.laps.findIndex(l => l === lap);
        const lapTime = (originalLapIndex > 0) 
            ? lap.totalTime - athlete.laps[originalLapIndex - 1].totalTime 
            : lap.totalTime;

        content += `${lap.lapNumber}\t`;
        content += `${lap.totalDistance}\t\t`;
        content += `${formatTime(lapTime)}\t`;
        content += `${formatTime(lap.totalTime)}\t`;
        content += `${new Date(lap.timestamp).toLocaleString()}\n`;
      });
    });
    
    if (!hasData) {
      alert('No data available for the selected date range.');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `track_timer_results_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8 print-hidden">
          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              Track Timer Pro
            </span>
          </h1>
          <p className="text-gray-400 mt-2">The ultimate stopwatch for athletes and coaches.</p>
        </header>

        <section className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-8 print-hidden">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">Athlete Setup</h2>
          <form onSubmit={handleAddAthlete}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="athleteName" className="block text-sm font-medium text-gray-400 mb-1">Athlete Name</label>
                <input
                  id="athleteName"
                  type="text"
                  value={newAthleteName}
                  onChange={e => setNewAthleteName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="targetDist" className="block text-sm font-medium text-gray-400 mb-1">Target/PB Dist (m)</label>
                    <input id="targetDist" type="number" placeholder="1600" value={newAthleteTargetDistance} onChange={e => setNewAthleteTargetDistance(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all" />
                 </div>
                 <div>
                    <label htmlFor="lapDist" className="block text-sm font-medium text-gray-400 mb-1">Lap Dist (m)</label>
                    <input id="lapDist" type="number" placeholder="400" value={newAthleteLapDistance} onChange={e => setNewAthleteLapDistance(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all" />
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        {lapDistancePresets.map(preset => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setNewAthleteLapDistance(String(preset))}
                                className="w-full text-center px-2 py-1 text-xs bg-gray-600 text-gray-300 rounded-md hover:bg-cyan-600 hover:text-white transition-colors"
                            >
                                {preset}m
                            </button>
                        ))}
                    </div>
                 </div>
              </div>
               <div>
                <label htmlFor="targetTime" className="block text-sm font-medium text-gray-400 mb-1">Target Time</label>
                <input id="targetTime" type="text" placeholder="MM:SS.ss" value={newAthleteTargetTime} onChange={e => setNewAthleteTargetTime(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all" />
                 <label htmlFor="pbTime" className="block text-sm font-medium text-gray-400 mb-1 mt-4">PB Time</label>
                <input id="pbTime" type="text" placeholder="MM:SS.ss" value={newAthletePbTime} onChange={e => setNewAthletePbTime(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-300 mb-3">Export Data</h3>
                <div className="flex items-end gap-4 flex-wrap">
                  <div>
                    <label htmlFor="startDate" className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
                    <input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-xs font-medium text-gray-400 mb-1">End Date</label>
                    <input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all" />
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <button type="button" onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors whitespace-nowrap">
                    <DownloadIcon className="w-5 h-5" />
                    Download (.txt)
                  </button>
                  <button type="button" onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap">
                    <PrintIcon className="w-5 h-5" />
                    Print / PDF
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-end">
                <button type="submit" className="h-full w-full md:w-auto px-8 py-4 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-600 transition-colors text-lg">
                  Add Athlete
                </button>
              </div>
            </div>
          </form>
        </section>

        {athletes.length > 0 ? (
          <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {athletes.map(athlete => (
              <div key={athlete.id} className="athlete-card">
                  <AthleteStopwatch
                    athlete={athlete}
                    onStartStop={handleStartStop}
                    onLap={handleLap}
                    onReset={handleReset}
                    onRemove={handleRemoveAthlete}
                    editingAthleteId={editingAthleteId}
                    onEdit={setEditingAthleteId}
                    onUpdate={handleUpdateAthlete}
                    onCancel={() => setEditingAthleteId(null)}
                  />
              </div>
            ))}
          </main>
        ) : (
          <div className="text-center py-16 px-6 bg-gray-800/50 rounded-xl print-hidden">
            <h2 className="text-2xl font-semibold text-gray-300">No Athletes Added Yet</h2>
            <p className="text-gray-500 mt-2">Use the form above to add your first athlete and start tracking time.</p>
          </div>
        )}

        <section>
          <AthleteComparisonTable athletes={athletes} />
        </section>

        <section>
           <OverallComparisonTable athletes={athletes} />
        </section>

      </div>
    </div>
  );
};

export default App;