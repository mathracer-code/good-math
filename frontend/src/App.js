import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';
import './App.css';

// Globe component for the 3D earth
function Globe({ onCountryClick, selectedCountry, radioStations }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(null);
  
  // Rotate the globe slowly
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
  });

  // Create country markers based on radio stations
  const countryMarkers = useMemo(() => {
    const countries = {};
    radioStations.forEach(station => {
      if (station.country && station.geo_lat && station.geo_long) {
        const key = station.country;
        if (!countries[key]) {
          countries[key] = {
            name: station.country,
            lat: parseFloat(station.geo_lat),
            lng: parseFloat(station.geo_long),
            count: 0
          };
        }
        countries[key].count++;
      }
    });
    return Object.values(countries);
  }, [radioStations]);

  // Convert lat/lng to sphere coordinates
  const latLngToVector3 = (lat, lng, radius = 2.05) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  return (
    <group>
      {/* Main Earth sphere */}
      <mesh ref={meshRef} onClick={(e) => e.stopPropagation()}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhongMaterial
          map={new THREE.TextureLoader().load('https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg')}
          bumpMap={new THREE.TextureLoader().load('https://threejs.org/examples/textures/earthbump1k.jpg')}
          bumpScale={0.05}
          specularMap={new THREE.TextureLoader().load('https://threejs.org/examples/textures/water_2048.jpg')}
          specular={new THREE.Color('grey')}
        />
      </mesh>

      {/* Country markers */}
      {countryMarkers.map((country, index) => {
        const position = latLngToVector3(country.lat, country.lng);
        return (
          <group key={country.name + index} position={position}>
            <mesh
              onPointerOver={() => setHovered(country.name)}
              onPointerOut={() => setHovered(null)}
              onClick={() => onCountryClick(country.name)}
            >
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial 
                color={selectedCountry === country.name ? '#ff6b6b' : '#4ecdc4'} 
                transparent
                opacity={0.8}
              />
            </mesh>
            {hovered === country.name && (
              <Html distanceFactor={8}>
                <div className="bg-black text-white px-2 py-1 rounded text-sm pointer-events-none">
                  {country.name} ({country.count} stations)
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Audio player component
function AudioPlayer({ currentStation, onStop }) {
  const audioRef = useRef();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentStation && audioRef.current) {
      setLoading(true);
      audioRef.current.src = currentStation.url_resolved || currentStation.url;
      audioRef.current.load();
    }
  }, [currentStation]);

  const togglePlay = async () => {
    if (!audioRef.current || !currentStation) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setLoading(false);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg">
      <audio
        ref={audioRef}
        onLoadStart={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => setLoading(false)}
        onEnded={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />
      
      {currentStation ? (
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg">{currentStation.name}</h3>
            <p className="text-gray-300 text-sm">
              {currentStation.country} • {currentStation.language} • {currentStation.tags}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-full font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm">Vol:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20"
              />
            </div>
            
            <button
              onClick={onStop}
              className="text-gray-400 hover:text-white px-3 py-2"
            >
              Stop
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400">
          Click on a country marker to discover radio stations
        </div>
      )}
    </div>
  );
}

// Station list component
function StationList({ stations, onStationSelect, selectedCountry }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredStations = stations.filter(station =>
    station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.tags.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed top-0 right-0 w-80 h-full bg-gray-800 text-white overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold mb-3">
          {selectedCountry ? `${selectedCountry} Stations` : 'Global Radio'}
        </h2>
        <input
          type="text"
          placeholder="Search stations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded text-white placeholder-gray-400"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredStations.length > 0 ? (
          filteredStations.map((station, index) => (
            <div
              key={station.stationuuid + index}
              onClick={() => onStationSelect(station)}
              className="p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors"
            >
              <h3 className="font-medium text-sm">{station.name}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {station.tags} • {station.language}
              </p>
              <p className="text-xs text-gray-500">
                {station.bitrate ? `${station.bitrate}kbps` : ''} • {station.codec}
              </p>
            </div>
          ))
        ) : (
          <div className="p-4 text-gray-400 text-center">
            {selectedCountry ? 'No stations found in this country' : 'Select a country to see stations'}
          </div>
        )}
      </div>
    </div>
  );
}

// Main App component
function App() {
  const [radioStations, setRadioStations] = useState([]);
  const [filteredStations, setFilteredStations] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [currentStation, setCurrentStation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRadioStations();
  }, []);

  const fetchRadioStations = async () => {
    try {
      setLoading(true);
      // Using Radio Browser API - free and comprehensive
      const response = await axios.get('https://de1.api.radio-browser.info/json/stations/search', {
        params: {
          limit: 1000,
          hidebroken: true,
          order: 'votes',
          reverse: true
        }
      });
      
      const stations = response.data.filter(station => 
        station.country && station.geo_lat && station.geo_long && station.url_resolved
      );
      
      setRadioStations(stations);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching radio stations:', error);
      setLoading(false);
    }
  };

  const handleCountryClick = (countryName) => {
    setSelectedCountry(countryName);
    const countryStations = radioStations.filter(
      station => station.country === countryName
    );
    setFilteredStations(countryStations);
  };

  const handleStationSelect = (station) => {
    setCurrentStation(station);
  };

  const handleStopPlaying = () => {
    setCurrentStation(null);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1639653279211-09958a51fb00')`
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black to-transparent p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">🌍 Global Radio</h1>
          <p className="text-gray-200">
            Discover and listen to radio stations from around the world
          </p>
          {loading && (
            <p className="text-blue-300 mt-2">Loading radio stations...</p>
          )}
        </div>
      </div>

      {/* 3D Globe */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 5]} intensity={0.8} />
          <Globe
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
            radioStations={radioStations}
          />
          <OrbitControls 
            enablePan={false}
            minDistance={4}
            maxDistance={15}
            autoRotate={false}
          />
        </Canvas>
      </div>

      {/* Station List Sidebar */}
      <StationList
        stations={filteredStations}
        onStationSelect={handleStationSelect}
        selectedCountry={selectedCountry}
      />

      {/* Audio Player */}
      <AudioPlayer
        currentStation={currentStation}
        onStop={handleStopPlaying}
      />

      {/* Instructions */}
      {!selectedCountry && !loading && (
        <div className="absolute bottom-20 left-6 bg-black bg-opacity-70 text-white p-4 rounded-lg max-w-sm">
          <h3 className="font-bold mb-2">How to use:</h3>
          <ul className="text-sm space-y-1">
            <li>• Rotate the globe by dragging</li>
            <li>• Click on the colored markers to discover stations</li>
            <li>• Use the sidebar to browse and select stations</li>
            <li>• Enjoy radio from around the world! 🎵</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;