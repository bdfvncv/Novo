// Sistema de Administração da Rádio
class AdminPanel {
    constructor() {
        this.isAuthenticated = false;
        this.adminPanel = document.getElementById('admin-panel');
        this.uploadSection = document.getElementById('upload-section');
        this.playlistView = document.getElementById('playlist-view');
        this.currentUploadType = CONFIG.contentTypes.MUSIC;
        this.uploadQueue = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthentication();
        Logger.info('Painel Admin inicializado');
    }

    setupEventListeners() {
        // Toggle Admin Panel
        document.getElementById('admin-toggle').addEventListener('click', () => {
            this.toggleAdminPanel();
        });

        // Botões do Admin
        document.getElementById('upload-music-btn').addEventListener('click', () => {
            this.showUploadSection(CONFIG.contentTypes.MUSIC);
        });

        document.getElementById('upload-ad-btn').addEventListener('click', () => {
            this.showUploadSection(CONFIG.contentTypes.AD);
        });

        document.getElementById('upload-announcement-btn').addEventListener('click', () => {
            this.showUploadSection(CONFIG.contentTypes.ANNOUNCEMENT);
        });

        document.getElementById('view-playlist-btn').addEventListener('click', () => {
            this.showPlaylist();
        });

        // Upload handlers
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        document.getElementById('upload-type').addEventListener('change', (e) => {
            this.currentUploadType = e.target.value;
        });

        document.getElementById('confirm-upload').addEventListener('click', () => {
            this.processUploadQueue();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+A para abrir admin
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                this.toggleAdminPanel();
            }
        });
    }

    async checkAuthentication() {
        // Em produção, implemente autenticação real
        // Por enquanto, usa localStorage
        const isAdmin = localStorage.getItem('isAdmin');
        
        if (isAdmin === 'true') {
            this.isAuthenticated = true;
        }
    }

    async authenticate() {
        // Sistema de autenticação simples
        // Em produção, use Supabase Auth
        const password = prompt('Digite a senha de administrador:');
        
        // Senha de demonstração (mude em produção!)
        if (password === 'admin123') {
            this.isAuthenticated = true;
            localStorage.setItem('isAdmin', 'true');
            this.showAdminPanel();
            Logger.info('Admin autenticado');
            return true;
        } else {
            alert('Senha incorreta!');
            return false;
        }
    }

    toggleAdminPanel() {
        if (!this.isAuthenticated) {
            this.authenticate();
            return;
        }

        if (this.adminPanel.style.display === 'none') {
            this.showAdminPanel();
        } else {
            this.hideAdminPanel();
        }
    }

    showAdminPanel() {
        this.adminPanel.style.display = 'block';
        this.adminPanel.scrollIntoView({ behavior: 'smooth' });
    }

    hideAdminPanel() {
        this.adminPanel.style.display = 'none';
        this.uploadSection.style.display = 'none';
        this.playlistView.style.display = 'none';
    }

    showUploadSection(type) {
        this.currentUploadType = type;
        this.uploadSection.style.display = 'block';
        this.playlistView.style.display = 'none';
        
        // Atualiza o select
        document.getElementById('upload-type').value = type;
        
        // Limpa input de arquivo
        document.getElementById('file-input').value = '';
        this.uploadQueue = [];
        
        Logger.info(`Seção de upload aberta para: ${type}`);
    }

    handleFileSelection(files) {
        this.uploadQueue = Array.from(files);
        
        if (this.uploadQueue.length > 0) {
            const fileList = this.uploadQueue.map(f => `• ${f.name} (${this.formatFileSize(f.size)})`).join('\n');
            
            if (confirm(`Arquivos selecionados:\n\n${fileList}\n\nDeseja fazer upload?`)) {
                document.getElementById('confirm-upload').disabled = false;
            } else {
                this.uploadQueue = [];
                document.getElementById('file-input').value = '';
            }
        }
    }

    async processUploadQueue() {
        if (this.uploadQueue.length === 0) {
            alert('Nenhum arquivo selecionado!');
            return;
        }

        const uploadBtn = document.getElementById('confirm-upload');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Enviando...';

        const progressDiv = document.createElement('div');
        progressDiv.className = 'upload-progress';
        progressDiv.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" id="upload-progress-fill"></div>
            </div>
            <div class="progress-text" id="upload-progress-text">0%</div>
        `;
        this.uploadSection.appendChild(progressDiv);

        try {
            // Verifica se cloudinaryUploader está disponível
            if (!window.cloudinaryUploader) {
                throw new Error('Sistema de upload não disponível');
            }

            const results = await cloudinaryUploader.uploadMultiple(
                this.uploadQueue,
                this.currentUploadType,
                (progress) => {
                    document.getElementById('upload-progress-fill').style.width = `${progress.percentage}%`;
                    document.getElementById('upload-progress-text').textContent = 
                        `${progress.percentage}% - ${progress.fileName}`;
                }
            );

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            alert(`Upload concluído!\n✔ Sucesso: ${successful}\n✗ Falhas: ${failed}`);
            
            // Limpa e reseta
            this.uploadQueue = [];
            document.getElementById('file-input').value = '';
            progressDiv.remove();
            
            // Recarrega playlist do player
            if (window.radioPlayer) {
                await window.radioPlayer.loadInitialPlaylist();
            }

        } catch (error) {
            Logger.error('Erro no upload:', error);
            alert('Erro ao fazer upload. Verifique o console para mais detalhes.');
            progressDiv.remove();
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Confirmar Upload';
        }
    }

    async showPlaylist() {
        this.playlistView.style.display = 'block';
        this.uploadSection.style.display = 'none';
        
        this.playlistView.innerHTML = '<div class="loading">Carregando playlist...</div>';

        try {
            // Verifica se supabaseManager está disponível
            if (!window.supabaseManager || !window.supabaseManager.initialized) {
                this.playlistView.innerHTML = '<div class="error">Banco de dados não disponível</div>';
                return;
            }

            const playlist = await supabaseManager.getPlaylist();
            
            if (playlist.length === 0) {
                this.playlistView.innerHTML = '<div class="empty-playlist">Playlist vazia</div>';
                return;
            }

            // Agrupa por tipo
            const grouped = this.groupByType(playlist);
            
            let html = '<div class="playlist-container">';
            
            for (const [type, items] of Object.entries(grouped)) {
                html += `
                    <div class="playlist-section">
                        <h4>${this.getTypeLabel(type)} (${items.length})</h4>
                        <div class="playlist-items">
                `;
                
                items.forEach(item => {
                    html += `
                        <div class="playlist-item" data-id="${item.id}">
                            <div class="item-info">
                                <div class="item-title">${item.title}</div>
                                <div class="item-artist">${item.artist}</div>
                                <div class="item-meta">
                                    ${item.duration ? `${this.formatDuration(item.duration)} • ` : ''}
                                    Tocada ${item.play_count || 0}x
                                </div>
                            </div>
                            <div class="item-actions">
                                <button class="btn-small" onclick="adminPanel.playPreview('${item.url}')">▶️</button>
                                <button class="btn-small btn-danger" onclick="adminPanel.removeItem(${item.id})">🗑️</button>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div></div>';
            }
            
            html += `
                <div class="playlist-stats">
                    <div>Total de itens: ${playlist.length}</div>
                    <div>Duração total: ${this.formatDuration(playlist.reduce((acc, item) => acc + (item.duration || 0), 0))}</div>
                </div>
            </div>
            `;
            
            this.playlistView.innerHTML = html;
            
        } catch (error) {
            Logger.error('Erro ao carregar playlist:', error);
            this.playlistView.innerHTML = '<div class="error">Erro ao carregar playlist</div>';
        }
    }

    groupByType(playlist) {
        return playlist.reduce((acc, item) => {
            if (!acc[item.type]) {
                acc[item.type] = [];
            }
            acc[item.type].push(item);
            return acc;
        }, {});
    }

    getTypeLabel(type) {
        const labels = {
            [CONFIG.contentTypes.MUSIC]: '🎵 Músicas',
            [CONFIG.contentTypes.AD]: '📢 Propagandas',
            [CONFIG.contentTypes.ANNOUNCEMENT]: '📣 Avisos',
            [CONFIG.contentTypes.TIME]: '🕐 Hora Certa'
        };
        return labels[type] || '📁 Outros';
    }

    playPreview(url) {
        // Cria player temporário para preview
        const previewAudio = new Audio(url);
        previewAudio.volume = 0.5;
        previewAudio.play();
        
        // Para após 10 segundos
        setTimeout(() => {
            previewAudio.pause();
            previewAudio.remove();
        }, 10000);
    }

    async removeItem(id) {
        if (!confirm('Tem certeza que deseja remover este item?')) {
            return;
        }

        try {
            if (!window.supabaseManager || !window.supabaseManager.initialized) {
                alert('Banco de dados não disponível');
                return;
            }

            await supabaseManager.deleteFromPlaylist(id);
            alert('Item removido com sucesso!');
            this.showPlaylist(); // Recarrega lista
            
            // Recarrega playlist do player
            if (window.radioPlayer) {
                await window.radioPlayer.loadInitialPlaylist();
            }
        } catch (error) {
            Logger.error('Erro ao remover item:', error);
            alert('Erro ao remover item');
        }
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (!seconds) return '00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // Estatísticas avançadas
    async showStatistics() {
        try {
            if (!window.supabaseManager || !window.supabaseManager.initialized) {
                alert('Banco de dados não disponível');
                return;
            }

            const stats = {
                totalSongs: await supabaseManager.getPlaylist(CONFIG.contentTypes.MUSIC),
                totalAds: await supabaseManager.getPlaylist(CONFIG.contentTypes.AD),
                totalAnnouncements: await supabaseManager.getPlaylist(CONFIG.contentTypes.ANNOUNCEMENT),
                activeListeners: await supabaseManager.getActiveListeners()
            };

            const statsHTML = `
                <div class="stats-dashboard">
                    <h3>📊 Estatísticas da Rádio</h3>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-number">${stats.totalSongs.length}</div>
                            <div class="stat-label">Músicas</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.totalAds.length}</div>
                            <div class="stat-label">Propagandas</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.totalAnnouncements.length}</div>
                            <div class="stat-label">Avisos</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.activeListeners}</div>
                            <div class="stat-label">Ouvintes Ativos</div>
                        </div>
                    </div>
                </div>
            `;

            // Adiciona ao painel
            const statsDiv = document.createElement('div');
            statsDiv.innerHTML = statsHTML;
            this.adminPanel.appendChild(statsDiv);

        } catch (error) {
            Logger.error('Erro ao carregar estatísticas:', error);
        }
    }

    // Export/Import da playlist
    async exportPlaylist() {
        try {
            if (!window.supabaseManager || !window.supabaseManager.initialized) {
                alert('Banco de dados não disponível');
                return;
            }

            const playlist = await supabaseManager.getPlaylist();
            const dataStr = JSON.stringify(playlist, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportLink = document.createElement('a');
            exportLink.setAttribute('href', dataUri);
            exportLink.setAttribute('download', `playlist_${new Date().toISOString()}.json`);
            exportLink.click();
            
            Logger.info('Playlist exportada');
        } catch (error) {
            Logger.error('Erro ao exportar playlist:', error);
        }
    }
