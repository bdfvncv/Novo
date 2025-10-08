// Radio Player Principal
class RadioPlayer {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.isPlaying = false;
        this.currentTrack = null;
        this.playlist = [];
        this.history = [];
        this.musicCount = 0;
        this.totalSongsPlayed = 0;
        this.startTime = Date.now();
        this.sessionId = this.generateSessionId();
        this.listenerInterval = null;
        this.clockInterval = null;
        this.fadeInterval = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.startClock();
        await this.loadInitialPlaylist();
        this.setupRealtimeUpdates();
        this.startListenerTracking();
        
        Logger.info('Radio Player inicializado');
    }

    setupEventListeners() {
        // Botão Play/Pause
        const playBtn = document.getElementById('play-btn');
        playBtn.addEventListener('click', () => this.togglePlay());

        // Controle de Volume
        const volumeSlider = document.getElementById('volume-slider');
        volumeSlider.addEventListener('input', (e) => {
            this.setVolume(e.target.value);
        });

        // Audio Events
        this.audio.addEventListener('ended', () => this.playNext());
        this.audio.addEventListener('error', (e) => this.handleError(e));
        this.audio.addEventListener('loadstart', () => this.onLoadStart());
        this.audio.addEventListener('canplay', () => this.onCanPlay());

        // Set volume inicial
        this.setVolume(CONFIG.programming.defaultVolume);
    }

    async togglePlay() {
        if (this.isPlaying) {
            await this.pause();
        } else {
            await this.play();
        }
    }

    async play() {
        try {
            if (!this.currentTrack) {
                await this.loadNextTrack();
            }

            await this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton(true);
            this.startVisualizer();
            
            Logger.info('Reprodução iniciada');
        } catch (error) {
            Logger.error('Erro ao iniciar reprodução:', error);
            this.handleError(error);
        }
    }

    async pause() {
        this.fadeOut(() => {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton(false);
            this.stopVisualizer();
            
            Logger.info('Reprodução pausada');
        });
    }

    setVolume(value) {
        this.audio.volume = value / 100;
        document.getElementById('volume-value').textContent = `${value}%`;
        document.getElementById('volume-slider').value = value;
    }

    fadeIn(callback) {
        const targetVolume = this.audio.volume;
        this.audio.volume = 0;
        
        clearInterval(this.fadeInterval);
        this.fadeInterval = setInterval(() => {
            if (this.audio.volume < targetVolume - 0.05) {
                this.audio.volume += 0.05;
            } else {
                this.audio.volume = targetVolume;
                clearInterval(this.fadeInterval);
                if (callback) callback();
            }
        }, CONFIG.programming.fadeDuration / 20);
    }

    fadeOut(callback) {
        const startVolume = this.audio.volume;
        
        clearInterval(this.fadeInterval);
        this.fadeInterval = setInterval(() => {
            if (this.audio.volume > 0.05) {
                this.audio.volume -= 0.05;
            } else {
                this.audio.volume = 0;
                clearInterval(this.fadeInterval);
                this.audio.volume = startVolume; // Restaura volume original
                if (callback) callback();
            }
        }, CONFIG.programming.fadeDuration / 20);
    }

    async loadInitialPlaylist() {
        try {
            // Carrega músicas, propagandas e avisos
            const [musics, ads, announcements] = await Promise.all([
                supabaseManager.getPlaylist(CONFIG.contentTypes.MUSIC),
                supabaseManager.getPlaylist(CONFIG.contentTypes.AD),
                supabaseManager.getPlaylist(CONFIG.contentTypes.ANNOUNCEMENT)
            ]);

            this.playlist = this.buildPlaylist(musics, ads, announcements);
            this.updateUpcomingList();
            
            Logger.info(`Playlist carregada: ${this.playlist.length} itens`);
        } catch (error) {
            Logger.error('Erro ao carregar playlist inicial:', error);
            this.loadFallbackContent();
        }
    }

    buildPlaylist(musics, ads, announcements) {
        const playlist = [];
        let musicIndex = 0;
        let adIndex = 0;
        let announcementIndex = 0;

        // Constrói playlist intercalada
        for (let i = 0; i < 50; i++) { // Prepara 50 itens
            // Adiciona música
            if (musics.length > 0) {
                playlist.push(musics[musicIndex % musics.length]);
                musicIndex++;
            }

            // Adiciona propaganda a cada N músicas
            if (i % CONFIG.programming.adFrequency === 2 && ads.length > 0) {
                playlist.push(ads[adIndex % ads.length]);
                adIndex++;
            }

            // Adiciona aviso a cada N músicas
            if (i % CONFIG.programming.announcementFrequency === 4 && announcements.length > 0) {
                playlist.push(announcements[announcementIndex % announcements.length]);
                announcementIndex++;
            }
        }

        return playlist.length > 0 ? playlist : this.getFallbackPlaylist();
    }

    getFallbackPlaylist() {
        // Playlist de demonstração
        return [
            {
                id: 'demo1',
                title: 'Música Demo 1',
                artist: 'Artista Demo',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.MUSIC,
                duration: 3
            },
            {
                id: 'demo2',
                title: 'Propaganda Demo',
                artist: 'Patrocinador',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.AD,
                duration: 2
            },
            {
                id: 'demo3',
                title: 'Música Demo 2',
                artist: 'Artista Demo',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.MUSIC,
                duration: 3
            }
        ];
    }

    async playNext() {
        try {
            // Verifica se é hora certa
            if (await this.checkAndPlayTimAnnouncement()) {
                return;
            }

            // Pega próximo da playlist
            await this.loadNextTrack();
            
            if (this.currentTrack) {
                await this.play();
            }
        } catch (error) {
            Logger.error('Erro ao tocar próxima:', error);
            setTimeout(() => this.playNext(), 3000);
        }
    }

    async checkAndPlayTimeAnnouncement() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Toca hora certa no início de cada hora
        if (CONFIG.programming.playTimeAnnouncement && minutes === 0 && seconds < 10) {
            const timeAnnouncement = await supabaseManager.getContentWithFallback(CONFIG.contentTypes.TIME);
            
            if (timeAnnouncement) {
                this.currentTrack = timeAnnouncement;
                this.updateNowPlaying(timeAnnouncement);
                this.audio.src = timeAnnouncement.url;
                return true;
            }
        }

        return false;
    }

    async loadNextTrack() {
        try {
            // Se playlist vazia, recarrega
            if (this.playlist.length === 0) {
                await this.loadInitialPlaylist();
            }

            // Pega próximo item
            this.currentTrack = this.playlist.shift();

            if (this.currentTrack) {
                this.updateNowPlaying(this.currentTrack);
                this.audio.src = this.currentTrack.url;
                
                // Adiciona ao histórico
                this.history.push(this.currentTrack);
                if (this.history.length > 10) {
                    this.history.shift();
                }

                // Atualiza estatísticas
                if (this.currentTrack.type === CONFIG.contentTypes.MUSIC) {
                    this.musicCount++;
                }
                this.totalSongsPlayed++;
                this.updateStats();

                // Salva no histórico do banco
                const listeners = await supabaseManager.getActiveListeners();
                await supabaseManager.addToHistory(this.currentTrack.id, listeners);
            }

            this.updateUpcomingList();
        } catch (error) {
            Logger.error('Erro ao carregar próxima faixa:', error);
        }
    }

    updateNowPlaying(track) {
        document.getElementById('current-track').textContent = track.title || 'Desconhecido';
        document.getElementById('current-artist').textContent = track.artist || '---';
        
        // Atualiza título da página
        document.title = `🎵 ${track.title} - Rádio 24H`;
    }

    updateUpcomingList() {
        const upcomingList = document.getElementById('upcoming-list');
        upcomingList.innerHTML = '';

        const upcoming = this.playlist.slice(0, 5);
        
        upcoming.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'upcoming-item';
            div.innerHTML = `
                <div class="upcoming-info">
                    <div class="upcoming-time">Em ${index + 1} ${index === 0 ? 'música' : 'músicas'}</div>
                    <div class="upcoming-title">${item.title}</div>
                </div>
                <span class="upcoming-type type-${item.type}">${this.getTypeLabel(item.type)}</span>
            `;
            upcomingList.appendChild(div);
        });
    }

    getTypeLabel(type) {
        const labels = {
            [CONFIG.contentTypes.MUSIC]: 'Música',
            [CONFIG.contentTypes.AD]: 'Propaganda',
            [CONFIG.contentTypes.ANNOUNCEMENT]: 'Aviso',
            [CONFIG.contentTypes.TIME]: 'Hora Certa'
        };
        return labels[type] || 'Outro';
    }

    updateStats() {
        document.getElementById('songs-played').textContent = this.totalSongsPlayed;
        
        // Atualiza tempo no ar
        const uptime = Date.now() - this.startTime;
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        document.getElementById('uptime').textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    async updateListenerCount() {
        const count = await supabaseManager.getActiveListeners();
        document.getElementById('listeners-count').textContent = count;
    }

    startListenerTracking() {
        // Atualiza presença do listener
        supabaseManager.updateListener(this.sessionId);
        
        // Atualiza a cada 30 segundos
        this.listenerInterval = setInterval(async () => {
            await supabaseManager.updateListener(this.sessionId);
            await this.updateListenerCount();
        }, 30000);

        // Atualiza contagem inicial
        this.updateListenerCount();
    }

    startClock() {
        const updateTime = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR');
            const dateStr = now.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            document.getElementById('current-time').textContent = timeStr;
            document.getElementById('current-date').textContent = dateStr;
        };

        updateTime();
        this.clockInterval = setInterval(updateTime, 1000);
    }

    updatePlayButton(playing) {
        const playBtn = document.getElementById('play-btn');
        const playIcon = playBtn.querySelector('.play-icon');
        const pauseIcon = playBtn.querySelector('.pause-icon');

        if (playing) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    startVisualizer() {
        const visualizer = document.querySelector('.visualizer');
        visualizer.classList.remove('paused');
    }

    stopVisualizer() {
        const visualizer = document.querySelector('.visualizer');
        visualizer.classList.add('paused');
    }

    setupRealtimeUpdates() {
        // Escuta mudanças na playlist
        supabaseManager.subscribeToUpdates((payload) => {
            Logger.info('Playlist atualizada:', payload);
            this.loadInitialPlaylist();
        });
    }

    handleError(error) {
        Logger.error('Erro no player:', error);
        
        // Tenta próxima música após erro
        setTimeout(() => {
            this.playNext();
        }, 3000);
    }

    onLoadStart() {
        Logger.debug('Carregando áudio...');
    }

    onCanPlay() {
        Logger.debug('Áudio pronto para reprodução');
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }

    loadFallbackContent() {
        Logger.warn('Usando conteúdo fallback');
        this.playlist = this.getFallbackPlaylist();
        this.updateUpcomingList();
    }
}

// Inicializa o player quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.radioPlayer = new RadioPlayer();
});