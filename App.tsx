
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, User, Mail, Phone, MapPin, 
  ChevronLeft, ChevronRight, ShieldCheck, 
  Star, Clock, ThumbsUp, Calendar, 
  MessageSquare, Briefcase, ArrowRight,
  Search, Droplets, Zap, Hammer,
  Monitor, Snowflake, Paintbrush,
  Eye, EyeOff, LogIn, UserPlus, Menu, X
} from 'lucide-react';
import { CATEGORIES, MOCK_WORKERS } from './constants';
import { MaintenanceWorker } from './types';
import { diagnoseIssue } from './services/geminiService';

declare var L: any; // Global Leaflet

const IconMap: { [key: string]: any } = {
  Droplets, Zap, Hammer, Monitor, Snowflake, Paintbrush
};

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const App: React.FC = () => {
  const [workers, setWorkers] = useState<MaintenanceWorker[]>(MOCK_WORKERS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<MaintenanceWorker | null>(null);
  const [viewMode, setViewMode] = useState<'landing' | 'list' | 'map' | 'login' | 'register' | 'detail'>('landing');
  const [previousViewMode, setPreviousViewMode] = useState<'list' | 'map'>('list');
  const [registerType, setRegisterType] = useState<'client' | 'pro'>('client');
  const [locationLoading, setLocationLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const mapRef = useRef<any>(null);
  const detailMapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const detailMapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<any>(null);

  const requestUserLocation = () => {
    setLocationLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(coords);
          setLocationLoading(false);
          if (mapRef.current) mapRef.current.flyTo([coords.lat, coords.lng], 15);
          if (viewMode === 'landing') setViewMode('list');
        },
        () => setLocationLoading(false),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      const matchesCategory = selectedCategory ? worker.category === selectedCategory : true;
      const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           worker.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCity = cityQuery ? worker.location.address.toLowerCase().includes(cityQuery.toLowerCase()) : true;
      return matchesCategory && matchesSearch && matchesCity;
    });
  }, [selectedCategory, searchQuery, cityQuery, workers]);

  useEffect(() => {
    if (viewMode === 'map' && mapContainerRef.current) {
      const timer = setTimeout(() => {
        if (!mapContainerRef.current) return;
        const center = userLocation || { lat: 4.0511, lng: 9.7679 }; // Douala center
        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current, { zoomControl: false }).setView([center.lat, center.lng], 13);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
          markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
        }
        markersLayerRef.current.clearLayers();
        filteredWorkers.forEach(worker => {
          const icon = L.divIcon({
            className: 'worker-map-marker',
            html: `<img src="${worker.avatar}" class="marker-avatar">`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          L.marker([worker.location.lat, worker.location.lng], { icon }).addTo(markersLayerRef.current)
            .on('click', () => handleWorkerClick(worker));
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, userLocation, filteredWorkers]);

  useEffect(() => {
    if (viewMode === 'detail' && selectedWorker && detailMapContainerRef.current) {
       const timer = setTimeout(() => {
         if (!detailMapContainerRef.current) return;
         if (!detailMapRef.current) {
            detailMapRef.current = L.map(detailMapContainerRef.current, { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false }).setView([selectedWorker.location.lat, selectedWorker.location.lng], 14);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(detailMapRef.current);
            const pinIcon = L.divIcon({
                className: 'custom-pin',
                html: '<div class="w-8 h-8 bg-blue-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white"><i class="fas fa-map-marker-alt text-xs"></i></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            L.marker([selectedWorker.location.lat, selectedWorker.location.lng], { icon: pinIcon }).addTo(detailMapRef.current);
         } else {
            detailMapRef.current.setView([selectedWorker.location.lat, selectedWorker.location.lng], 14);
         }
       }, 200);
       return () => clearTimeout(timer);
    }
  }, [viewMode, selectedWorker]);

  const handleWorkerClick = (worker: MaintenanceWorker) => {
    setSelectedWorker(worker);
    if (viewMode === 'list' || viewMode === 'map') {
      setPreviousViewMode(viewMode);
    }
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = async () => {
    if (searchQuery.length > 5) {
      setAiLoading(true);
      const result = await diagnoseIssue(searchQuery);
      if (result) { setSelectedCategory(result.category); }
      setAiLoading(false);
    }
    setViewMode('list');
  };

  const renderHeader = () => (
    <nav className="border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-[1001]">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setViewMode('landing')}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
              <Wrench size={20} />
            </div>
            <span className="text-xl font-black text-slate-800 tracking-tighter">
              Maintenance<span className="text-accent">Connect</span>
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-8 text-slate-500 font-bold text-[11px] uppercase tracking-widest">
            <button onClick={() => setViewMode('list')} className="hover:text-primary transition-colors hover:scale-105 active:scale-95">Trouver un pro</button>
            <button className="hover:text-primary transition-colors hover:scale-105 active:scale-95">Comment ça marche</button>
            <button className="hover:text-primary transition-colors font-black text-primary/80 hover:scale-105 active:scale-95">Partenaires</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setViewMode('login')} className="flex items-center gap-2 text-slate-600 font-bold text-[11px] uppercase tracking-widest px-5 py-2.5 hover:bg-slate-50 rounded-xl transition-all active:scale-95">
            <LogIn size={16} /> Connexion
          </button>
          <button onClick={() => setViewMode('register')} className="bg-brand text-slate-900 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all">
            Rejoignez-nous
          </button>
        </div>
      </div>
    </nav>
  );

  const renderPartners = () => (
    <div className="py-20 border-y border-slate-100 bg-white shadow-sm overflow-hidden px-6">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-16">Propulsé par les leaders du marché</p>
        <div className="marquee-container">
          <div className="marquee-content grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
            {['TotalEnergies', 'Orange Business', 'CFAO Retail', 'Bridge Bank', 'MTN Group', 'Eneo Cameroon', 'SABC', 'Tradex'].map((p, i) => (
              <div key={i} className="flex items-center gap-4 text-3xl font-black text-slate-900 mx-20">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs">MC</div> {p}
              </div>
            ))}
          </div>
          <div className="marquee-content grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
            {['TotalEnergies', 'Orange Business', 'CFAO Retail', 'Bridge Bank', 'MTN Group', 'Eneo Cameroon', 'SABC', 'Tradex'].map((p, i) => (
              <div key={i} className="flex items-center gap-4 text-3xl font-black text-slate-900 mx-20">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs">MC</div> {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderHero = () => (
    <section className="relative pt-28 pb-40 lg:pt-40 lg:pb-56 overflow-hidden bg-white">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[900px] bg-gradient-to-b from-slate-50/50 to-transparent -z-10"></div>
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-accent/5 rounded-full blur-[140px] -z-10 animate-pulse"></div>
      
      <div className="max-w-5xl mx-auto px-6 text-center space-y-14">
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-12"
        >
          <div className="inline-flex items-center gap-3 bg-slate-100 p-1 pr-5 rounded-full text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-200 group mx-auto">
            <span className="bg-accent text-white px-3 py-1 rounded-full font-black uppercase text-[9px] tracking-widest">Nouveau</span>
            <span className="flex items-center gap-2">Experts certifiés disponibles à Yaoundé & Douala <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></span>
          </div>
          
          <h1 className="text-6xl lg:text-9xl font-black text-slate-900 leading-[0.88] tracking-[-0.04em] font-display">
            La maintenance<br /> 
            <span className="gradient-text-pro italic">redéfinie</span>.
          </h1>
          
          <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Plomberie, Climatisation, Électricité et IT. Expertise certifiée et intervention garantie en moins de 60 minutes sur l'ensemble du territoire.
          </p>

          <div className="relative max-w-2xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent to-brand rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white border border-slate-100 rounded-[2rem] p-3 shadow-2xl flex flex-col md:flex-row items-center gap-3">
              <div className="flex-1 w-full flex items-center px-5 gap-4">
                <Search size={22} className="text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Quel expert cherchez-vous ?" 
                  className="w-full py-5 text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none text-[16px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="w-px h-10 bg-slate-100 hidden md:block"></div>
              <div className="flex-1 w-full flex items-center px-5 gap-4">
                <MapPin size={22} className="text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Votre ville..." 
                  className="w-full py-5 text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none text-[16px]"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={handleSearch}
                className="w-full md:w-auto bg-slate-900 text-white px-12 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
              >
                Rechercher
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );

  const renderCategories = () => (
    <section className="py-32 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-24 space-y-7">
          <div className="inline-block px-5 py-2 bg-accent/5 border border-accent/10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-accent">Catalogue</div>
          <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight font-display italic leading-none">Expertises Certifiées.</h2>
          <p className="text-xl text-slate-400 font-medium leading-relaxed">
            Un réseau séléctif regroupant les meilleurs techniciens validés par nos ingénieurs.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {CATEGORIES.map((cat, idx) => {
            const Icon = IconMap[cat.icon] || Wrench;
            return (
              <motion.div 
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
                onClick={() => { setSelectedCategory(cat.id); setViewMode('list'); }}
                className="group bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-premium cursor-pointer transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="text-[110px] font-black text-slate-50 absolute -bottom-10 -right-5 pointer-events-none group-hover:text-accent/5 transition-colors duration-500">
                  {idx + 1}
                </div>
                
                <div className="relative z-10 space-y-10">
                  <div className="w-22 h-22 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-400 shadow-inner group-hover:bg-accent group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                    <Icon size={40} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight font-display">{cat.name}</h3>
                    <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-[220px] mx-auto transition-colors">
                      {cat.description}
                    </p>
                  </div>
                  <div className="pt-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 text-white rounded-2xl group-hover:bg-accent group-hover:scale-110 transition-all duration-500 shadow-xl">
                      <ArrowRight size={22} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderRecommended = () => (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-6">
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight font-display italic leading-none">Top Experts.</h2>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">
            Professionnels sollicités et mieux notés de notre réseau.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {workers.map(worker => (
            <motion.div 
              key={worker.id} 
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 group cursor-pointer" 
              onClick={() => handleWorkerClick(worker)}
            >
              <div className="relative h-60 overflow-hidden">
                <img src={worker.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={worker.name} />
                <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> En ligne
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-lg group-hover:text-accent transition-colors">{worker.name}</h4>
                  <div className="flex items-center gap-1 text-orange-500 font-black text-[12px]"><Star size={12} className="fill-current" /> {worker.rating}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {worker.skills.slice(0, 2).map((skill, i) => (
                    <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[8.5px] font-black uppercase tracking-widest border border-slate-100">{skill}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest pb-4 border-b border-slate-100">
                  <MapPin size={14} className="text-accent" /> {worker.location.address}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{worker.experience} exp.</div>
                  <div className="text-xl font-black text-slate-900">{worker.hourlyRate.toLocaleString()} <span className="text-[10px] text-slate-300">FCFA/H</span></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <button 
            onClick={() => setViewMode('list')} 
            className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-accent transition-all shadow-lg active:scale-95"
          >
            Voir tous les experts <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );

  const renderHowItWorks = () => (
    <section className="py-32 bg-slate-900 text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/5 -skew-x-12 translate-x-1/2"></div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-24 space-y-7">
          <h2 className="text-5xl lg:text-7xl font-black tracking-tight font-display italic">Simplicité. Rapidité. <span className="text-accent underline decoration-white/10 underline-offset-8">Sérénité.</span></h2>
          <p className="text-2xl text-slate-400 font-medium leading-relaxed mx-auto">
            Trois étapes pour régler vos urgences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
          {[
            { icon: Search, title: 'Diagnostic AI', desc: 'Identifiez l\'origine du problème instantanément.' },
            { icon: MessageSquare, title: 'Mise en relation', desc: 'Précisez votre demande et recevez un devis.' },
            { icon: ShieldCheck, title: 'Service garanti', desc: 'Paiement sécurisé après satisfaction.' },
          ].map((item, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="relative group "
            >
              <div className="text-[120px] font-black text-white/5 absolute -top-20 left-0 transition-transform group-hover:scale-110 pointer-events-none group-hover:text-accent/10 duration-700">0{i + 1}</div>
              <div className="relative z-10">
                <div className="w-18 h-18 bg-accent rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-accent/20 mb-10 group-hover:-rotate-6 transition-all duration-500">
                  <item.icon size={36} />
                </div>
                <h3 className="text-3xl font-black mb-5 tracking-tight font-display">{item.title}</h3>
                <p className="text-lg text-slate-400 font-medium leading-relaxed group-hover:text-slate-200 transition-colors">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderCTA = () => (
    <section className="py-24 bg-white px-6">
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-slate-900 rounded-[3rem] p-10 lg:p-20 text-white overflow-hidden shadow-premium">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-accent opacity-10 blur-[100px]"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-10">
              <div className="inline-block px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-[9px] font-black uppercase tracking-[0.3em]">Action</div>
              <h2 className="text-4xl lg:text-6xl font-black leading-[0.95] tracking-tighter font-display">Prêt à régler<br /> <span className="text-accent underline underline-offset-8 decoration-accent/30 italic">votre problème ?</span></h2>
              <p className="text-lg text-slate-400 font-medium max-w-md leading-relaxed">
                Plus de 10,000 clients au Cameroun nous font confiance quotidiennement.
              </p>
              <div className="flex flex-wrap gap-5">
                <button onClick={() => setViewMode('list')} className="bg-white text-slate-900 px-10 py-4.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-white/5 flex items-center gap-3">
                  C'est parti <ArrowRight size={16} />
                </button>
                <button onClick={() => setViewMode('register')} className="bg-brand text-slate-900 px-10 py-4.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-brand/20">
                  Rejoignez-nous
                </button>
              </div>
            </div>

            <div className="w-full lg:w-[450px]">
              <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 space-y-8 group hover:border-white/20 transition-all duration-700 shadow-2xl">
                <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white shadow-xl shadow-accent/20 group-hover:scale-110 transition-transform duration-500">
                  <Briefcase size={28} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-black tracking-tight font-display">Devenir Expert</h3>
                  <p className="text-base text-slate-400 font-medium leading-relaxed">
                    Professionnel qualifié ? Boostez votre visibilité et recevez des missions certifiées.
                  </p>
                </div>
                <button onClick={() => setViewMode('register')} className="w-full bg-white/10 hover:bg-white text-white hover:text-slate-900 py-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-3">
                  Créer mon compte pro <UserPlus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderFooter = () => (
    <footer className="bg-[#0b1120] text-white pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <Wrench size={20} />
            </div>
            <span className="text-2xl font-black tracking-tighter">Maintenance<span className="text-accent">Connect</span></span>
          </div>
          <p className="text-slate-400 text-sm font-medium leading-[1.8] max-w-xs">
            La plateforme n°1 au Cameroun pour trouver des experts en maintenance certifiés et disponibles instantanément.
          </p>
          <div className="flex gap-4">
            {['facebook', 'twitter', 'instagram', 'linkedin'].map((social) => (
              <a key={social} href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                <Briefcase size={18} />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold text-lg mb-10 tracking-tight">Services.</h4>
          <ul className="space-y-5 text-sm text-slate-400 font-medium">
            {CATEGORIES.slice(0, 5).map(c => <li key={c.id}><a href="#" className="hover:text-white transition-colors">{c.name}</a></li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-lg mb-10 tracking-tight">Liens utiles.</h4>
          <ul className="space-y-5 text-sm text-slate-400 font-medium">
            <li><a href="#" className="hover:text-white transition-colors">Comment ça marche</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Devenir partenaire</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Villes couvertes</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Support client</a></li>
            <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-lg mb-10 tracking-tight">Contactez-nous.</h4>
          <ul className="space-y-6 text-sm text-slate-400 font-medium">
            <li className="flex items-center gap-4 group">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                <Mail size={16} />
              </div>
              contact@expert.cm
            </li>
            <li className="flex items-center gap-4 group">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                <Phone size={16} />
              </div>
              +237 6XX XXX XXX
            </li>
            <li className="flex items-center gap-4 group">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                <MapPin size={16} />
              </div>
              Douala, Cameroun
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
        <span>© 2026 MaintenanceConnect. Tous droits réservés.</span>
        <div className="flex gap-8">
          <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
          <a href="#" className="hover:text-white transition-colors">CGU</a>
        </div>
      </div>
    </footer>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {renderHeader()}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f7fa]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[480px] w-full bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] p-12 border border-slate-200"
        >
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bon retour !</h2>
            <p className="text-slate-400 font-medium">Accédez à votre espace MaintenanceConnect</p>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                <input 
                  type="email" 
                  placeholder="votre@email.com" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-4.5 text-slate-900 text-sm font-semibold focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-slate-300" 
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mot de passe</label>
                <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:brightness-125 transition-all">Oublié ?</button>
              </div>
              <div className="relative group">
                <Briefcase size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-4.5 text-slate-900 text-sm font-semibold focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-slate-300" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button onClick={() => setViewMode('landing')} className="w-full bg-accent text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-4">
              Se connecter <ArrowRight size={18} />
            </button>
          </div>
          
          <div className="mt-12 text-center text-sm font-medium text-slate-400">
            Pas encore de compte ? <button onClick={() => setViewMode('register')} className="text-accent font-black hover:underline ml-2">Créer un profil professionnel</button>
          </div>
        </motion.div>
      </div>
      {renderFooter()}
    </div>
  );

  const renderRegister = () => (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {renderHeader()}
      <div className="flex-1 flex items-center justify-center p-6 py-12 bg-[#f4f7fa]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[500px] w-full bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] p-12 border border-slate-200"
        >
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Rejoignez-nous !</h2>
            <p className="text-slate-400 font-medium px-4">Le plus grand réseau d'experts au Cameroun.</p>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Type de compte</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setRegisterType('client')}
                  className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all gap-3 ${registerType === 'client' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                >
                  <User size={24} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Client</span>
                </button>
                <button 
                  onClick={() => setRegisterType('pro')}
                  className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all gap-3 ${registerType === 'pro' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                >
                  <Wrench size={24} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Expert</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Prénom</label>
                <input type="text" placeholder="Jean" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-sm font-semibold outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all" />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nom</label>
                <input type="text" placeholder="Dupont" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-sm font-semibold outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary" />
                <input type="email" placeholder="votre@email.com" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-12 py-4 text-sm font-semibold outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Mot de passe</label>
              <div className="relative group">
                <Briefcase size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary" />
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-12 py-4 text-sm font-semibold outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button onClick={() => setViewMode('landing')} className="w-full bg-accent text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-accent/20 hover:brightness-110 transition-all flex items-center justify-center gap-4">
              Créer mon compte <UserPlus size={18} />
            </button>
          </div>

          <div className="mt-12 text-center text-sm font-medium text-slate-400">
            Déjà un compte ? <button onClick={() => setViewMode('login')} className="text-accent font-black hover:underline ml-2">Se connecter</button>
          </div>
        </motion.div>
      </div>
      {renderFooter()}
    </div>
  );

  const renderWorkerDetail = () => {
    if (!selectedWorker) return null;
    return (
      <div className="min-h-screen bg-[#f8fafc] pb-24 animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto px-6 pt-8">
          <button 
            onClick={() => setViewMode(previousViewMode)} 
            className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold text-[10px] uppercase tracking-widest mb-12 transition-colors group"
          >
            <ChevronLeft size={16} />
            Retour aux experts
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 flex flex-col md:flex-row gap-10 items-start relative overflow-hidden">
                <div className="relative flex-shrink-0">
                  <img src={selectedWorker.avatar} alt={selectedWorker.name} className="w-32 h-32 md:w-48 md:h-48 rounded-[2.5rem] object-cover shadow-2xl border-4 border-white" />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl border-2 border-white">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div> Disponible
                  </div>
                </div>

                <div className="flex-1 space-y-6 pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">{selectedWorker.name}</h1>
                    <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Vérifié
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-8">
                    <span className="bg-primary text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                       {CATEGORIES.find(c => c.id === selectedWorker.category)?.name}
                    </span>
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                      <MapPin size={16} className="text-primary" /> {selectedWorker.location.address}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                      <Clock size={16} className="text-primary" /> {selectedWorker.experience} d'exp.
                    </div>
                  </div>

                  <div className="flex items-center gap-8 pt-4">
                    <div className="flex items-center gap-2">
                      <Star size={24} className="text-orange-500 fill-current" />
                      <span className="text-slate-900 font-black text-2xl">{selectedWorker.rating}</span>
                      <span className="text-slate-400 font-bold text-sm">({selectedWorker.reviews} avis)</span>
                    </div>
                    <div className="text-3xl font-black text-primary tracking-tight">
                      {selectedWorker.hourlyRate.toLocaleString()} <span className="text-sm text-slate-300 font-bold tracking-widest">FCFA/H</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100/50 p-1.5 rounded-2xl flex max-w-fit gap-2">
                <button className="bg-white text-slate-900 px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">À propos</button>
                <button className="text-slate-400 hover:text-slate-600 px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Avis ({selectedWorker.reviews})</button>
                <button className="text-slate-400 hover:text-slate-600 px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Disponibilités</button>
              </div>

              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-12 space-y-12">
                <div className="space-y-6">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Description expertise.</h2>
                  <p className="text-slate-500 font-medium leading-relaxed text-lg">
                    {CATEGORIES.find(c => c.id === selectedWorker.category)?.name} certifié(e). Spécialisé(e) dans la maintenance technique de haute précision au Cameroun.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 rounded-[2.5rem] p-10 flex items-center gap-8 border border-slate-100">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-primary shadow-xl shadow-slate-200/50">
                      <ThumbsUp size={32} />
                    </div>
                    <div>
                      <div className="text-4xl font-black text-slate-900 leading-none mb-2">120+</div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Réussites</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-[2.5rem] p-10 flex items-center gap-8 border border-slate-100">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-primary shadow-xl shadow-slate-200/50">
                      <Clock size={32} />
                    </div>
                    <div>
                      <div className="text-4xl font-black text-slate-900 leading-none mb-2">&lt; 30 min</div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Réponse</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/20 p-10 space-y-10">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Prendre contact.</h3>
                  <p className="text-slate-400 text-sm font-medium">Réservez en quelques secondes.</p>
                </div>
                
                <div className="space-y-4">
                  <button className="w-full bg-primary text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 hover:brightness-110 transition-all active:scale-[0.98]">
                    <Calendar size={18} /> Réserver un créneau
                  </button>
                  <button className="w-full bg-white border border-slate-200 text-slate-900 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-[0.98]">
                    <MessageSquare size={18} className="text-primary" /> Message direct
                  </button>
                </div>

                <div className="pt-10 border-t border-slate-100 space-y-6">
                  <div className="flex items-center gap-6 group">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-colors">
                      <Phone size={18} />
                    </div>
                    <span className="text-sm font-black text-slate-700">{selectedWorker.phone}</span>
                  </div>
                  <div className="flex items-center gap-6 group">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-colors">
                      <Mail size={18} />
                    </div>
                    <span className="text-sm font-black text-slate-700">partenaire@expert.cm</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 pb-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Localisation.</h3>
                </div>
                <div className="h-72 relative">
                  <div ref={detailMapContainerRef} className="w-full h-full"></div>
                </div>
                <div className="p-10 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500 flex items-center gap-3">
                    <MapPin size={14} className="text-primary" /> {selectedWorker.location.address}, Cameroun
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (viewMode === 'login') return renderLogin();
  if (viewMode === 'register') return renderRegister();

  return (
    <div className="min-h-screen bg-white selection:bg-primary/10">
      {renderHeader()}

      <AnimatePresence mode="wait">
        {viewMode === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderHero()}
            {renderPartners()}
            {renderCategories()}
            {renderRecommended()}
            {renderHowItWorks()}
            {renderCTA()}
            {renderFooter()}
          </motion.div>
        ) : (
          <PageTransition key={viewMode}>
            <main className="max-w-7xl mx-auto px-6 py-16 min-h-[calc(100vh-80px)] flex flex-col">
              {viewMode === 'detail' ? renderWorkerDetail() : (
                <>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-16">
                    <div className="space-y-4">
                      <button onClick={() => setViewMode('landing')} className="text-slate-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-primary transition-all">
                        <ChevronLeft size={14} /> Retour à l'accueil
                      </button>
                      <h2 className="text-5xl font-black text-slate-900 tracking-tighter">
                        {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : "Experts vérifiés"}
                        {cityQuery && <span className="text-primary italic"> à {cityQuery}</span>}
                      </h2>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                      <button onClick={() => setViewMode('list')} className={`px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Liste</button>
                      <button onClick={() => setViewMode('map')} className={`px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Carte</button>
                    </div>
                  </div>

                  <div className="flex-1">
                    {viewMode === 'list' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-20">
                        {filteredWorkers.map(worker => (
                          <div key={worker.id} className="bg-white rounded-[2.5rem] border border-slate-200/60 overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-500 group" onClick={() => handleWorkerClick(worker)}>
                            <div className="p-10 space-y-8">
                              <div className="flex items-start justify-between">
                                <img src={worker.avatar} className="w-24 h-24 rounded-3xl object-cover shadow-xl border-4 border-white group-hover:scale-105 transition-transform" alt={worker.name} />
                                <div className="text-right flex flex-col items-end gap-2">
                                  <div className="text-2xl font-black text-slate-900 leading-none">{worker.hourlyRate.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold tracking-widest">FCFA/H</span></div>
                                  <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-lg font-black text-[10px] flex items-center gap-1"><Star size={10} className="fill-current" /> {worker.rating}</div>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-primary transition-colors">{worker.name}</h4>
                                <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] uppercase tracking-widest">
                                  <MapPin size={14} className="text-primary" /> {worker.location.address}
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {worker.skills.map((skill, idx) => (
                                    <span key={idx} className="px-5 py-2 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">{skill}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center group-hover:bg-primary transition-all">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white/80">{worker.experience} d'expérience</span>
                              <div className="text-primary group-hover:text-white transition-colors">
                                <ArrowRight size={20} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-[3rem] h-[700px] border border-slate-200/80 shadow-2xl overflow-hidden relative mb-20">
                         <div ref={mapContainerRef} className="w-full h-full"></div>
                      </div>
                    )}
                  </div>
                  {renderFooter()}
                </>
              )}
            </main>
          </PageTransition>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
