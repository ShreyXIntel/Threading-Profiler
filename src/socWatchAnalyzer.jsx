import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ScatterChart, Scatter } from 'recharts';
import { Upload, X, TrendingUp, Cpu, Activity, Zap, ChevronRight, Folder, BarChart3, FileText, Trash2, Archive } from 'lucide-react';
import { Button } from './components/custom/buttons/button';
import { Cards } from './components/custom/cards/cards';
import { BtnBgShadow } from './components/custom/buttons/btn-bg-shadow';
import { Popup } from './components/custom/popup/popup';

const SoCWatchAnalyzer = () => {
  // State: SKUs contain directories, each directory contains multiple games
  const [skus, setSkus] = useState([]); // [{name, games: [], isArchived: false}]
  const [archivedSkus, setArchivedSkus] = useState([]); // [{name, games: [], isArchived: true}]
  const [activeView, setActiveView] = useState('overall'); // 'overall', 'focused', or 'comparison'
  const [selectedGame, setSelectedGame] = useState(null); // For focused view
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedGamesForComparison, setSelectedGamesForComparison] = useState([]); // [{game, skuName}]
  const [isProcessing, setIsProcessing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Popup state
  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedSkus = localStorage.getItem('socwatch_skus');
      const savedArchivedSkus = localStorage.getItem('socwatch_archived_skus');

      if (savedSkus) {
        setSkus(JSON.parse(savedSkus));
      }
      if (savedArchivedSkus) {
        setArchivedSkus(JSON.parse(savedArchivedSkus));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    } finally {
      // Mark data as loaded (even if there was nothing to load)
      setIsDataLoaded(true);
    }
  }, []);

  // Track if data has been loaded from localStorage
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Save SKUs to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    if (!isDataLoaded) return; // Don't save until data is loaded
    try {
      localStorage.setItem('socwatch_skus', JSON.stringify(skus));
    } catch (error) {
      console.error('Error saving SKUs to localStorage:', error);
    }
  }, [skus, isDataLoaded]);

  // Save archived SKUs to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    if (!isDataLoaded) return; // Don't save until data is loaded
    try {
      localStorage.setItem('socwatch_archived_skus', JSON.stringify(archivedSkus));
    } catch (error) {
      console.error('Error saving archived SKUs to localStorage:', error);
    }
  }, [archivedSkus, isDataLoaded]);

  // Parse Intel SoC Watch CSV
  const parseIntelSoCWatch = (fileContent, filename) => {
    const lines = fileContent.split('\n');
    const profile = {
      name: filename.replace('.csv', '').replace(/PTATMonitor.*/, '').trim(),
      metadata: {},
      coreTypes: {},
      cStateData: [],
      avgFrequencies: []
    };

    // Extract metadata
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      if (lines[i].includes('Collection duration')) {
        const match = lines[i].match(/(\d+\.?\d*)/);
        if (match) profile.metadata.duration = parseFloat(match[1]);
      }
      if (lines[i].includes('CPU Base Operating Frequency')) {
        const match = lines[i].match(/(\d+)/);
        if (match) profile.metadata.baseFreq = parseInt(match[1]);
      }
      if (lines[i].includes('Total # of cores:')) {
        const match = lines[i].match(/(\d+)/);
        if (match) profile.metadata.totalCores = parseInt(match[1]);
      }
    }

    // Extract core types
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/Package_0\/Core_(\d+) = (LNC|SKT)/);
      if (match) {
        const coreNum = parseInt(match[1]);
        profile.coreTypes[coreNum] = match[2] === 'LNC' ? 'P-Core' : 'E-Core';
      }
    }

    // Parse C-State data
    let cStateStartIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Core C-State Summary: Residency (Percentage and Time)')) {
        cStateStartIdx = i + 1;
        break;
      }
    }

    if (cStateStartIdx > 0) {
      let cStateLines = [];
      for (let i = cStateStartIdx; i < lines.length; i++) {
        if (lines[i].trim() === '' || lines[i].includes('Core C-State Summary: Total Samples')) break;
        cStateLines.push(lines[i]);
      }

      if (cStateLines.length > 2) {
        const dataRows = cStateLines.slice(2);
        dataRows.forEach(row => {
          const values = row.split(',');
          const state = values[0]?.trim();
          if (state && !state.includes('---')) {
            for (let coreId = 0; coreId < profile.metadata.totalCores; coreId++) {
              const residency = parseFloat(values[coreId + 1]) || 0;
              let coreData = profile.cStateData.find(c => c.core === coreId);
              if (!coreData) {
                coreData = {
                  core: coreId,
                  type: profile.coreTypes[coreId] || 'Unknown',
                  active: 0,
                  cc6: 0,
                  cc7: 0
                };
                profile.cStateData.push(coreData);
              }
              if (state.includes('CC0') || state.includes('CC1')) coreData.active = residency;
              else if (state.includes('CC6')) coreData.cc6 = residency;
              else if (state.includes('CC7')) coreData.cc7 = residency;
            }
          }
        });
      }
    }

    // Parse frequency data
    let freqStartIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('CPU P-State Average Frequency (excluding CPU idle time)')) {
        freqStartIdx = i + 1;
        break;
      }
    }

    if (freqStartIdx > 0) {
      for (let i = freqStartIdx; i < lines.length; i++) {
        if (lines[i].trim() === '' || lines[i].includes('CPU P-State/Frequency Summary')) break;
        const match = lines[i].match(/Core_(\d+).*?,\s*(\d+)/);
        if (match) {
          const coreNum = parseInt(match[1]);
          const freq = parseInt(match[2]);
          profile.avgFrequencies.push({
            core: coreNum,
            freq: freq,
            type: profile.coreTypes[coreNum] || 'Unknown'
          });
        }
      }
    }

    // Merge frequency into cState
    profile.cStateData.forEach(cData => {
      const freqData = profile.avgFrequencies.find(f => f.core === cData.core);
      if (freqData) cData.freq = freqData.freq;
    });

    return profile;
  };

  // Generate insights for a game profile
  const generateInsights = (profile) => {
    const pCores = profile.cStateData.filter(c => c.type === 'P-Core');
    const eCores = profile.cStateData.filter(c => c.type === 'E-Core');

    const avgPActivity = pCores.reduce((sum, c) => sum + c.active, 0) / pCores.length;
    const avgEActivity = eCores.reduce((sum, c) => sum + c.active, 0) / eCores.length;
    const avgPFreq = pCores.reduce((sum, c) => sum + (c.freq || 0), 0) / pCores.length;
    const avgEFreq = eCores.reduce((sum, c) => sum + (c.freq || 0), 0) / eCores.length;

    const pCoreActivity = pCores.reduce((s, c) => s + c.active, 0) / pCores.length;
    const eCoreActivity = eCores.reduce((s, c) => s + c.active, 0) / eCores.length;

    // Overall threading ratio (for heatmap table)
    const threadingRatio = pCoreActivity / (eCoreActivity || 1);

    return {
      pCoreActivity: pCoreActivity.toFixed(1),
      eCoreActivity: eCoreActivity.toFixed(1),
      pCoreAvgFreq: avgPFreq.toFixed(0),
      eCoreAvgFreq: avgEFreq.toFixed(0),
      threadingRatio: threadingRatio.toFixed(2),
      threadingModel: avgPActivity > avgEActivity + 10 ? 'P-Core Dominant' :
                      avgEActivity > avgPActivity + 10 ? 'E-Core Dominant' : 'Balanced',
    };
  };

  // Handle directory upload
  const handleDirectoryUpload = async (event, skuName) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsProcessing(true);
    try {
      const games = [];
      for (const file of files) {
        if (file.name.endsWith('.csv')) {
          const content = await file.text();
          const profile = parseIntelSoCWatch(content, file.name);
          profile.insights = generateInsights(profile);
          games.push(profile);
        }
      }

      // Check if SKU already exists
      const existingSku = skus.find(s => s.name === skuName);
      if (existingSku) {
        setSkus(skus.map(s => s.name === skuName ? { ...s, games: [...s.games, ...games] } : s));
      } else {
        setSkus([...skus, { name: skuName, games }]);
      }
    } catch (error) {
      console.error('Error parsing files:', error);
      setPopup({
        isOpen: true,
        title: 'Error Parsing Files',
        message: 'Make sure they are Intel SoC Watch CSV files.',
        type: 'error',
        onConfirm: null
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Get heatmap color based on threading ratio
  const getHeatmapColorForRatio = (ratio) => {
    // ratio < 0.95 = green (good E-core usage)
    // ratio 0.95-1.05 = yellow (balanced)
    // ratio > 1.05 = red (P-core dominant)
    if (ratio < 0.95) return '#10b981'; // green
    if (ratio > 1.05) return '#ef4444'; // red
    return '#fbbf24'; // yellow
  };

  // Toggle game for comparison
  const toggleGameComparison = (game, skuName) => {
    const gameId = `${skuName}-${game.name}`;
    const existingIndex = selectedGamesForComparison.findIndex(
      g => `${g.skuName}-${g.game.name}` === gameId
    );

    if (existingIndex >= 0) {
      setSelectedGamesForComparison(
        selectedGamesForComparison.filter((_, idx) => idx !== existingIndex)
      );
    } else if (selectedGamesForComparison.length < 4) {
      setSelectedGamesForComparison([...selectedGamesForComparison, { game, skuName }]);
    } else {
      setPopup({
        isOpen: true,
        title: 'Selection Limit Reached',
        message: 'Maximum 4 games can be compared at once. Please deselect a game first.',
        type: 'warning',
        onConfirm: null
      });
    }
  };

  // Check if a game is selected for comparison
  const isGameSelectedForComparison = (game, skuName) => {
    const gameId = `${skuName}-${game.name}`;
    return selectedGamesForComparison.some(
      g => `${g.skuName}-${g.game.name}` === gameId
    );
  };

  // Remove a specific game from a SKU
  const removeGame = (skuName, gameIndex) => {
    const updatedSkus = skus.map(sku => {
      if (sku.name === skuName) {
        const updatedGames = sku.games.filter((_, idx) => idx !== gameIndex);
        return { ...sku, games: updatedGames };
      }
      return sku;
    }).filter(sku => sku.games.length > 0); // Remove SKU if no games left

    setSkus(updatedSkus);

    // Clear selected game if it was removed
    if (selectedGame && selectedGame.skuName === skuName) {
      const game = skus.find(s => s.name === skuName)?.games[gameIndex];
      if (game && selectedGame.name === game.name) {
        setSelectedGame(null);
        setActiveView('overall');
      }
    }
  };

  // Remove entire SKU directory
  const removeSku = (skuName) => {
    setPopup({
      isOpen: true,
      title: 'Remove Directory',
      message: `Are you sure you want to remove the entire "${skuName}" directory and all its files?`,
      type: 'warning',
      confirmText: 'Remove',
      onConfirm: () => {
        setSkus(skus.filter(sku => sku.name !== skuName));

        // Clear selected game if it was in this SKU
        if (selectedGame && selectedGame.skuName === skuName) {
          setSelectedGame(null);
          setActiveView('overall');
        }
      }
    });
  };

  // Archive a SKU
  const archiveSku = (skuName) => {
    const skuToArchive = skus.find(sku => sku.name === skuName);
    if (!skuToArchive) return;

    setSkus(skus.filter(sku => sku.name !== skuName));
    setArchivedSkus([...archivedSkus, { ...skuToArchive, isArchived: true }]);

    // Clear selected game if it was in this SKU
    if (selectedGame && selectedGame.skuName === skuName) {
      setSelectedGame(null);
      setActiveView('overall');
    }
  };

  // Unarchive a SKU
  const unarchiveSku = (skuName) => {
    const skuToUnarchive = archivedSkus.find(sku => sku.name === skuName);
    if (!skuToUnarchive) return;

    setArchivedSkus(archivedSkus.filter(sku => sku.name !== skuName));
    setSkus([...skus, { ...skuToUnarchive, isArchived: false }]);
  };

  // Sidebar with game tabs grouped by SKU/folder
  const Sidebar = () => {
    const totalFiles = skus.reduce((sum, sku) => sum + sku.games.length, 0);
    const hasMultipleFiles = totalFiles > 1;

    return (
      <div className="w-64 bg-[#89ddd6] border-r-[3px] border-gray-900 h-full overflow-y-auto flex-shrink-0 sidebar-scroll">
        <div className="p-4 border-b-[3px] border-gray-900 bg-[#4fb39c]">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Navigation
          </h2>
        </div>

        {/* View Mode Toggle */}
        <div className="p-3 border-b-[3px] border-gray-900">
          <div className="space-y-2">
            <button
              onClick={() => setActiveView('overall')}
              className={`w-full text-left px-3 py-2 rounded-[4px] border-[3px] border-gray-900 font-bold transition-all ${
                activeView === 'overall' ? 'bg-[#2563eb] text-white' : 'bg-white text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Overall Threading
            </button>
            <button
              onClick={() => setActiveView('focused')}
              disabled={!selectedGame}
              className={`w-full text-left px-3 py-2 rounded-[4px] border-[3px] border-gray-900 font-bold transition-all ${
                activeView === 'focused' ? 'bg-[#2563eb] text-white' : 'bg-white text-gray-900'
              } ${!selectedGame ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Focused Analysis
            </button>
            <button
              onClick={() => {
                if (hasMultipleFiles) {
                  setComparisonMode(!comparisonMode);
                  if (comparisonMode) {
                    // Exit comparison mode
                    setSelectedGamesForComparison([]);
                    setActiveView('overall');
                  }
                }
              }}
              disabled={!hasMultipleFiles}
              className={`w-full text-left px-3 py-2 rounded-[4px] border-[3px] border-gray-900 font-bold transition-all ${
                comparisonMode ? 'bg-[#55d355] text-white' : 'bg-[#8b3ecf] text-white'
              } ${!hasMultipleFiles ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              {comparisonMode ? `Compare (${selectedGamesForComparison.length})` : 'Compare Mode'}
            </button>
          </div>
        </div>

        {/* Archive Toggle */}
        <div className="p-3 border-b-[3px] border-gray-900">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full text-left px-3 py-2 rounded-[4px] border-[3px] border-gray-900 font-bold transition-all bg-[#99a75d] text-white"
          >
            <Archive className="w-4 h-4 inline mr-2" />
            {showArchived ? 'Show Active' : `Show Archived (${archivedSkus.length})`}
          </button>
        </div>

        {/* Game List Grouped by SKU/Folder */}
        <div className="p-3">
          {showArchived ? (
            archivedSkus.length === 0 ? (
              <p className="text-sm text-gray-700 font-bold">No archived directories</p>
            ) : (
              <div className="space-y-3">
                {archivedSkus.map((sku) => (
                  <div key={sku.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-gray-900 uppercase flex items-center gap-1">
                        <Archive className="w-3 h-3" />
                        {sku.name}
                      </h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => unarchiveSku(sku.name)}
                          className="p-1 bg-[#55d355] border-[2px] border-gray-900 rounded-[2px] hover:-translate-y-[1px] transition-all"
                          title="Unarchive"
                        >
                          <Upload className="w-3 h-3 text-white" />
                        </button>
                        <button
                          onClick={() => {
                            setPopup({
                              isOpen: true,
                              title: 'Delete Permanently',
                              message: `Are you sure you want to permanently delete "${sku.name}"? This action cannot be undone.`,
                              type: 'error',
                              confirmText: 'Delete',
                              onConfirm: () => {
                                setArchivedSkus(archivedSkus.filter(s => s.name !== sku.name));
                              }
                            });
                          }}
                          className="p-1 bg-[#d00000] border-[2px] border-gray-900 rounded-[2px] hover:-translate-y-[1px] transition-all"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 font-bold pl-4">{sku.games.length} games</p>
                  </div>
                ))}
              </div>
            )
          ) : skus.length === 0 ? (
            <p className="text-sm text-gray-700 font-bold">No games loaded</p>
          ) : (
            <div className="space-y-3">
              {skus.map((sku) => (
                <div key={sku.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 uppercase flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {sku.name}
                    </h3>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveSku(sku.name);
                        }}
                        className="p-1 bg-[#99a75d] border-[2px] border-gray-900 rounded-[2px] hover:-translate-y-[1px] transition-all"
                        title="Archive"
                      >
                        <Archive className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSku(sku.name);
                        }}
                        className="p-1 bg-[#d00000] border-[2px] border-gray-900 rounded-[2px] hover:-translate-y-[1px] transition-all"
                        title="Remove Directory"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 pl-1">
                    {sku.games.map((game, idx) => {
                      const isSelected = isGameSelectedForComparison(game, sku.name);
                      return (
                        <div
                          key={`${sku.name}-${game.name}-${idx}`}
                          className={`flex items-center gap-2 rounded-[4px] border-[2px] border-gray-900 transition-all ${
                            comparisonMode && isSelected
                              ? 'bg-[#2563eb] border-[3px]'
                              : selectedGame?.name === game.name && selectedGame?.skuName === sku.name
                              ? 'bg-[#ffd500]'
                              : 'bg-white'
                          }`}
                        >
                          {comparisonMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGameComparison(game, sku.name);
                              }}
                              className={`ml-2 w-4 h-4 rounded-[2px] border-[2px] border-gray-900 flex items-center justify-center transition-all ${
                                isSelected ? 'bg-white' : 'bg-white'
                              }`}
                              title="Select for comparison"
                            >
                              {isSelected && <div className="w-2 h-2 bg-[#2563eb] rounded-[1px]"></div>}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (comparisonMode) {
                                toggleGameComparison(game, sku.name);
                              } else {
                                setSelectedGame({ ...game, skuName: sku.name });
                                setActiveView('focused');
                              }
                            }}
                            className={`flex-1 text-left px-3 py-2 font-bold text-sm hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all ${
                              comparisonMode && isSelected ? 'text-white' : ''
                            }`}
                          >
                            <div className="truncate">{game.name}</div>
                          </button>
                          {!comparisonMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPopup({
                                  isOpen: true,
                                  title: 'Remove File',
                                  message: `Are you sure you want to remove "${game.name}"?`,
                                  type: 'warning',
                                  confirmText: 'Remove',
                                  onConfirm: () => {
                                    removeGame(sku.name, idx);
                                  }
                                });
                              }}
                              className="p-1 mr-1 bg-[#d00000] border-[2px] border-gray-900 rounded-[2px] hover:-translate-y-[1px] transition-all"
                              title="Remove File"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Comparison View
  const ComparisonView = () => {
    if (selectedGamesForComparison.length === 0) {
      return (
        <div className="p-6">
          <Cards className="p-10 text-center">
            <TrendingUp className="w-20 h-20 text-gray-900 mx-auto mb-4" />
            <h3 className="text-3xl font-black mb-2 text-gray-900">No Games Selected</h3>
            <p className="text-lg font-bold text-gray-700">Select 2-4 games from the sidebar to compare their threading profiles</p>
          </Cards>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-5xl font-black text-gray-900">Game Comparison</h1>
        </div>

        {/* Side-by-side comparison table */}
        <Cards className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-[3px] border-gray-900">
              <thead>
                <tr className="bg-[#4fb39c]">
                  <th className="border-[3px] border-gray-900 px-4 py-3 text-left font-black text-gray-900 sticky left-0 bg-[#4fb39c]">Metric</th>
                  {selectedGamesForComparison.map((item, idx) => (
                    <th key={idx} className="border-[3px] border-gray-900 px-4 py-3 text-center font-black text-gray-900 min-w-[180px]">
                      <div className="truncate">{item.game.name}</div>
                      <div className="text-xs font-bold text-gray-700 mt-1">{item.skuName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">P-Core Activity %</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td
                      key={idx}
                      className="border-[3px] border-gray-900 px-4 py-3 text-center font-black"
                      style={{
                        backgroundColor: getHeatmapColorForRatio(parseFloat(item.game.insights.threadingRatio)),
                        color: '#111827'
                      }}
                    >
                      {item.game.insights.pCoreActivity}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">E-Core Activity %</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td
                      key={idx}
                      className="border-[3px] border-gray-900 px-4 py-3 text-center font-black"
                      style={{
                        backgroundColor: getHeatmapColorForRatio(parseFloat(item.game.insights.threadingRatio)),
                        color: '#111827'
                      }}
                    >
                      {item.game.insights.eCoreActivity}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">P/E Ratio</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td
                      key={idx}
                      className="border-[3px] border-gray-900 px-4 py-3 text-center font-black"
                      style={{
                        backgroundColor: getHeatmapColorForRatio(parseFloat(item.game.insights.threadingRatio)),
                        color: '#111827'
                      }}
                    >
                      {item.game.insights.threadingRatio}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">Threading Model</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td key={idx} className="border-[3px] border-gray-900 px-4 py-3 text-center font-bold text-gray-900">
                      {item.game.insights.threadingModel}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">P-Core Avg Freq (MHz)</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td key={idx} className="border-[3px] border-gray-900 px-4 py-3 text-center font-bold text-gray-900">
                      {item.game.insights.pCoreAvgFreq}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">E-Core Avg Freq (MHz)</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td key={idx} className="border-[3px] border-gray-900 px-4 py-3 text-center font-bold text-gray-900">
                      {item.game.insights.eCoreAvgFreq}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">Total Cores</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td key={idx} className="border-[3px] border-gray-900 px-4 py-3 text-center font-bold text-gray-900">
                      {item.game.metadata.totalCores}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border-[3px] border-gray-900 px-4 py-3 font-black text-gray-900 sticky left-0 bg-white">Duration (s)</td>
                  {selectedGamesForComparison.map((item, idx) => (
                    <td key={idx} className="border-[3px] border-gray-900 px-4 py-3 text-center font-bold text-gray-900">
                      {item.game.metadata.duration}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm font-bold text-gray-900">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#10b981] border-[2px] border-gray-900"></div>
              <span>&lt; 0.95 (Good E-Core Usage)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#fbbf24] border-[2px] border-gray-900"></div>
              <span>0.95-1.05 (Balanced)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#ef4444] border-[2px] border-gray-900"></div>
              <span>&gt; 1.05 (P-Core Dominant)</span>
            </div>
          </div>
        </Cards>
      </div>
    );
  };

  // Overall Threading Behavior View (with heatmap table)
  const OverallView = () => {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-5xl font-black text-gray-900">Overall Threading Behavior</h1>
        </div>

        {skus.length === 0 ? (
          <Cards className="p-10 text-center">
            <p className="text-xl font-bold text-gray-700">No data loaded</p>
          </Cards>
        ) : (
          skus.map(sku => (
            <Cards key={sku.name} className="p-6">
              <h2 className="text-3xl font-black mb-4 text-gray-900 flex items-center gap-2">
                <Cpu className="w-8 h-8" />
                {sku.name}
              </h2>

              {/* Heatmap Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-[3px] border-gray-900">
                  <thead>
                    <tr className="bg-[#4fb39c]">
                      <th className="border-[3px] border-gray-900 px-4 py-3 text-left font-black text-gray-900">Game</th>
                      <th className="border-[3px] border-gray-900 px-4 py-3 text-center font-black text-gray-900">P-Core Activity %</th>
                      <th className="border-[3px] border-gray-900 px-4 py-3 text-center font-black text-gray-900">E-Core Activity %</th>
                      <th className="border-[3px] border-gray-900 px-4 py-3 text-center font-black text-gray-900">P/E Ratio</th>
                      <th className="border-[3px] border-gray-900 px-4 py-3 text-center font-black text-gray-900">Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sku.games.map((game, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#899bdd] transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedGame({ ...game, skuName: sku.name });
                          setActiveView('focused');
                        }}
                      >
                        <td className="border-[3px] border-gray-900 px-4 py-3 font-bold text-gray-900">{game.name}</td>
                        <td
                          className="border-[3px] border-gray-900 px-4 py-3 text-center font-black"
                          style={{
                            backgroundColor: getHeatmapColorForRatio(parseFloat(game.insights.threadingRatio)),
                            color: '#111827'
                          }}
                        >
                          {game.insights.pCoreActivity}
                        </td>
                        <td
                          className="border-[3px] border-gray-900 px-4 py-3 text-center font-black"
                          style={{
                            backgroundColor: getHeatmapColorForRatio(parseFloat(game.insights.threadingRatio)),
                            color: '#111827'
                          }}
                        >
                          {game.insights.eCoreActivity}
                        </td>
                        <td
                          className="border-[3px] border-gray-900 px-4 py-3 text-center font-black"
                          style={{
                            backgroundColor: getHeatmapColorForRatio(parseFloat(game.insights.threadingRatio)),
                            color: '#111827'
                          }}
                        >
                          {game.insights.threadingRatio}
                        </td>
                        <td className="border-[3px] border-gray-900 px-4 py-3 text-center font-bold text-gray-900">
                          {game.insights.threadingModel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm font-bold text-gray-900">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#10b981] border-[2px] border-gray-900"></div>
                  <span>&lt; 0.95 (Good E-Core Usage)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#fbbf24] border-[2px] border-gray-900"></div>
                  <span>0.95-1.05 (Balanced)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#ef4444] border-[2px] border-gray-900"></div>
                  <span>&gt; 1.05 (P-Core Dominant)</span>
                </div>
              </div>
            </Cards>
          ))
        )}
      </div>
    );
  };

  // Focused Game Analysis View
  const FocusedView = () => {
    if (!selectedGame) {
      return (
        <div className="p-6">
          <Cards className="p-10 text-center">
            <Activity className="w-20 h-20 text-gray-900 mx-auto mb-4" />
            <h3 className="text-3xl font-black mb-2 text-gray-900">No Game Selected</h3>
            <p className="text-lg font-bold text-gray-700">Select a game from the sidebar to view detailed analysis</p>
          </Cards>
        </div>
      );
    }

    const pCores = selectedGame.cStateData.filter(c => c.type === 'P-Core');
    const eCores = selectedGame.cStateData.filter(c => c.type === 'E-Core');

    // Color gradient: Light blue (96a5fd) at 0% to Dark blue (1e3a8a) at 100%
    const getActivityColor = (percentage) => {
      const r = Math.round(147 - percentage * 0.81); // 147 to 30
      const g = Math.round(197 - percentage * 1.16); // 197 to 81
      const b = Math.round(253 - percentage * 0.51); // 253 to 202
      return `rgb(${r}, ${g}, ${b})`;
    };

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-black text-gray-900">{selectedGame.name}</h1>
            <p className="text-lg font-bold text-gray-700 mt-2">
              SKU: {selectedGame.skuName} | Cores: {selectedGame.metadata.totalCores} | Duration: {selectedGame.metadata.duration}s
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <Cards className="p-6 bg-[#ec8385]">
          <h2 className="text-2xl font-black mb-4 text-gray-900">Key Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border-[3px] border-gray-900 p-4 rounded-[4px]">
              <div className="text-sm font-bold text-gray-600">P-Core Activity</div>
              <div className="text-2xl font-black text-gray-900">{selectedGame.insights.pCoreActivity}%</div>
            </div>
            <div className="bg-white border-[3px] border-gray-900 p-4 rounded-[4px]">
              <div className="text-sm font-bold text-gray-600">E-Core Activity</div>
              <div className="text-2xl font-black text-gray-900">{selectedGame.insights.eCoreActivity}%</div>
            </div>
            <div className="bg-white border-[3px] border-gray-900 p-4 rounded-[4px]">
              <div className="text-sm font-bold text-gray-600">P/E Ratio</div>
              <div className="text-2xl font-black text-gray-900">{selectedGame.insights.threadingRatio}</div>
            </div>
            <div className="bg-white border-[3px] border-gray-900 p-4 rounded-[4px]">
              <div className="text-sm font-bold text-gray-600">Threading Model</div>
              <div className="text-xl font-black text-gray-900">{selectedGame.insights.threadingModel}</div>
            </div>
          </div>
        </Cards>

        {/* CPU Architecture Heatmap + Charts Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ alignItems: 'stretch' }}>
          {/* LEFT: CPU Architecture Heatmap - Arrow Lake Ultra 9 285K Layout */}
          <Cards className="p-6 bg-heatmap-card flex flex-col" style={{ height: '580px' }}>
            <h3 className="text-xl font-black mb-4 text-gray-900">CPU Architecture Heatmap</h3>
            <div className="bg-heatmap-bg p-5 rounded-[4px] border-[3px] border-gray-900 flex-1 flex flex-col justify-between" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <div className="flex gap-3 mx-auto w-full" style={{ maxWidth: '480px' }}>
                {/* LEFT SIDE */}
                <div className="flex-1 flex flex-col gap-1.5">
                  {/* P0 - Top Large P-Core */}
                  {pCores[0] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[0].active),
                        height: '72px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[0].core}</div>
                      <div className="text-xl font-black text-white">{pCores[0].active.toFixed(1)}%</div>
                    </div>
                  )}

                  {/* E0-E3 - Top E-Core Cluster */}
                  <div className="grid grid-cols-2 gap-1.5 border-[3px] border-white rounded-[4px] p-2 bg-[#1e40af]/20">
                    {eCores.slice(0, 4).map((core) => (
                      <div
                        key={core.core}
                        className="border-[2px] border-white rounded-[3px] flex flex-col items-center justify-center"
                        style={{
                          backgroundColor: getActivityColor(core.active),
                          height: '42px'
                        }}
                      >
                        <div className="text-xs font-bold text-white">E{core.core}</div>
                        <div className="text-sm font-black text-white">{core.active.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>

                  {/* P1 - Middle Top P-Core */}
                  {pCores[1] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[1].active),
                        height: '68px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[1].core}</div>
                      <div className="text-xl font-black text-white">{pCores[1].active.toFixed(1)}%</div>
                    </div>
                  )}

                  {/* P2 - Middle Bottom P-Core */}
                  {pCores[2] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[2].active),
                        height: '68px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[2].core}</div>
                      <div className="text-xl font-black text-white">{pCores[2].active.toFixed(1)}%</div>
                    </div>
                  )}

                  {/* E8-E11 - Bottom E-Core Cluster */}
                  <div className="grid grid-cols-2 gap-1.5 border-[3px] border-white rounded-[4px] p-2 bg-[#1e40af]/20">
                    {eCores.slice(8, 12).map((core) => (
                      <div
                        key={core.core}
                        className="border-[2px] border-white rounded-[3px] flex flex-col items-center justify-center"
                        style={{
                          backgroundColor: getActivityColor(core.active),
                          height: '42px'
                        }}
                      >
                        <div className="text-xs font-bold text-white">E{core.core}</div>
                        <div className="text-sm font-black text-white">{core.active.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>

                  {/* P3 - Bottom Large P-Core */}
                  {pCores[3] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[3].active),
                        height: '72px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[3].core}</div>
                      <div className="text-xl font-black text-white">{pCores[3].active.toFixed(1)}%</div>
                    </div>
                  )}
                </div>

                {/* CENTER - Die-to-Die Interconnect */}
                <div className="w-8 flex flex-col items-center justify-center">
                  <div className="w-full h-full bg-gradient-to-b from-[#60a5fa] via-[#3b82f6] to-[#60a5fa] border-[2px] border-white/30 rounded-[2px] flex items-center justify-center">
                    <div className="text-[8px] font-black text-white transform -rotate-90 whitespace-nowrap">RING</div>
                  </div>
                </div>

                {/* RIGHT SIDE (MIRROR) */}
                <div className="flex-1 flex flex-col gap-1.5">
                  {/* P4 - Top Large P-Core */}
                  {pCores[4] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[4].active),
                        height: '72px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[4].core}</div>
                      <div className="text-xl font-black text-white">{pCores[4].active.toFixed(1)}%</div>
                    </div>
                  )}

                  {/* E4-E7 - Top E-Core Cluster */}
                  <div className="grid grid-cols-2 gap-1.5 border-[3px] border-white rounded-[4px] p-2 bg-[#1e40af]/20">
                    {eCores.slice(4, 8).map((core) => (
                      <div
                        key={core.core}
                        className="border-[2px] border-white rounded-[3px] flex flex-col items-center justify-center"
                        style={{
                          backgroundColor: getActivityColor(core.active),
                          height: '42px'
                        }}
                      >
                        <div className="text-xs font-bold text-white">E{core.core}</div>
                        <div className="text-sm font-black text-white">{core.active.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>

                  {/* P5 - Middle Top P-Core */}
                  {pCores[5] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[5].active),
                        height: '68px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[5].core}</div>
                      <div className="text-xl font-black text-white">{pCores[5].active.toFixed(1)}%</div>
                    </div>
                  )}

                  {/* P6 - Middle Bottom P-Core */}
                  {pCores[6] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[6].active),
                        height: '68px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[6].core}</div>
                      <div className="text-xl font-black text-white">{pCores[6].active.toFixed(1)}%</div>
                    </div>
                  )}

                  {/* E12-E15 - Bottom E-Core Cluster */}
                  <div className="grid grid-cols-2 gap-1.5 border-[3px] border-white rounded-[4px] p-2 bg-[#1e40af]/20">
                    {eCores.slice(12, 16).map((core) => (
                      <div
                        key={core.core}
                        className="border-[2px] border-white rounded-[3px] flex flex-col items-center justify-center"
                        style={{
                          backgroundColor: getActivityColor(core.active),
                          height: '42px'
                        }}
                      >
                        <div className="text-xs font-bold text-white">E{core.core}</div>
                        <div className="text-sm font-black text-white">{core.active.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>

                  {/* P7 - Bottom Large P-Core */}
                  {pCores[7] && (
                    <div
                      className="border-[3px] border-white rounded-[4px] flex flex-col items-center justify-center"
                      style={{
                        backgroundColor: getActivityColor(pCores[7].active),
                        height: '72px'
                      }}
                    >
                      <div className="text-base font-bold text-white">P{pCores[7].core}</div>
                      <div className="text-xl font-black text-white">{pCores[7].active.toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-white mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 border-[2px] border-white rounded-[2px]" style={{ backgroundColor: getActivityColor(0) }}></div>
                  <span>Low (0%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 border-[2px] border-white rounded-[2px]" style={{ backgroundColor: getActivityColor(50) }}></div>
                  <span>Med (50%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 border-[2px] border-white rounded-[2px]" style={{ backgroundColor: getActivityColor(100) }}></div>
                  <span>High (100%)</span>
                </div>
              </div>
            </div>
          </Cards>

          {/* RIGHT: Charts Section */}
          <div className="flex flex-col gap-6" style={{ height: '580px' }}>
            {/* Core Activity Distribution */}
            <Cards className="p-6">
              <h3 className="text-lg font-bold mb-3 text-gray-900">Core Activity Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={selectedGame.cStateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" strokeWidth={2} />
                  <XAxis dataKey="core" stroke="#111827" strokeWidth={2} />
                  <YAxis stroke="#111827" strokeWidth={2} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #111827', borderRadius: '4px' }} />
                  <Legend />
                  <Bar dataKey="active" name="Active %" stroke="#111827" strokeWidth={2}>
                    {selectedGame.cStateData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.type === 'P-Core' ? '#4338ca' : '#60a5fa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Cards>

            {/* Frequency by Core */}
            <Cards className="p-6">
              <h3 className="text-lg font-bold mb-3 text-gray-900">Frequency by Core</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={selectedGame.cStateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" strokeWidth={2} />
                  <XAxis dataKey="core" stroke="#111827" strokeWidth={2} />
                  <YAxis stroke="#111827" strokeWidth={2} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #111827', borderRadius: '4px' }} />
                  <Legend />
                  <Bar dataKey="freq" name="Frequency (MHz)" stroke="#111827" strokeWidth={2}>
                    {selectedGame.cStateData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.type === 'P-Core' ? '#4338ca' : '#60a5fa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Cards>
          </div>
        </div>
      </div>
    );
  };

  // Header/Navbar with upload buttons
  const Header = () => {
    const [folderName, setFolderName] = useState('');
    const hasData = skus.length > 0;

    const handleFileSelection = async (event) => {
      const files = Array.from(event.target.files);
      if (files.length === 0) return;

      // Auto-detect directory name from first file path if available
      let detectedFolderName = folderName.trim();
      if (!detectedFolderName && files.length > 0 && files[0].webkitRelativePath) {
        // Extract parent directory name from path
        const pathParts = files[0].webkitRelativePath.split('/');
        if (pathParts.length > 1) {
          detectedFolderName = pathParts[0];
        }
      }

      // If still no name, use "Untitled"
      if (!detectedFolderName) {
        detectedFolderName = 'Untitled';
      }

      await handleDirectoryUpload(event, detectedFolderName);
      setFolderName('');
    };

    return (
      <div className="bg-[#4fb39c] border-b-[4px] border-gray-900 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Cpu className="w-8 h-8 text-gray-900" />
          <h1 className="text-2xl font-black text-gray-900">Intel SoC Watch Analyzer</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* System message */}
          {comparisonMode && selectedGamesForComparison.length > 0 && (
            <div className="px-4 py-2 bg-[#2563eb] border-[3px] border-gray-900 rounded-[4px] font-bold text-white text-sm">
              {selectedGamesForComparison.length} game{selectedGamesForComparison.length > 1 ? 's' : ''} selected
            </div>
          )}

          {/* Upload buttons */}
          <label className="block">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] border-[3px] border-gray-900 rounded-[4px] font-bold text-white cursor-pointer hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all">
              <Folder className="w-5 h-5" />
              Select Folder
            </div>
            <input
              type="file"
              className="hidden"
              accept=".csv"
              multiple
              webkitdirectory=""
              directory=""
              onChange={handleFileSelection}
              disabled={isProcessing}
            />
          </label>
          <label className="block">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#8b3ecf] border-[3px] border-gray-900 rounded-[4px] font-bold text-white cursor-pointer hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all">
              <Upload className="w-5 h-5" />
              Select Files
            </div>
            <input
              type="file"
              className="hidden"
              accept=".csv"
              multiple
              onChange={handleFileSelection}
              disabled={isProcessing}
            />
          </label>
        </div>
      </div>
    );
  };

  // Footer
  const Footer = () => {
    return (
      <div className="bg-[#4fb39c] border-t-[4px] border-gray-900 px-6 py-3 flex items-center justify-center flex-shrink-0">
        <p className="text-sm font-bold text-gray-900">
          Developed by <span className="font-black">Shrey & Satya</span> © Copyright @ Intel SiV Gaming LAB
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#fffbeb] overflow-hidden absolute inset-0">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          {comparisonMode ? <ComparisonView /> : activeView === 'overall' ? <OverallView /> : <FocusedView />}
        </div>
      </div>
      <Footer />
      <Popup
        isOpen={popup.isOpen}
        onClose={() => setPopup({ ...popup, isOpen: false })}
        title={popup.title}
        message={popup.message}
        type={popup.type}
        onConfirm={popup.onConfirm}
        confirmText={popup.confirmText}
        cancelText={popup.cancelText}
      />
    </div>
  );
};

export default SoCWatchAnalyzer;
