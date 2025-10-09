// Supabase Client e Database Manager
class SupabaseManager {
    constructor() {
        this.supabase = null;
        this.initialized = false;
        this.initializeSupabase();
    }

    async initializeSupabase() {
        try {
            // Carrega o Supabase client via CDN
            await this.loadSupabaseScript();
            
            // Inicializa o cliente
            if (window.supabase && window.supabase.createClient) {
                this.supabase = window.supabase.createClient(
                    CONFIG.supabase.url,
                    CONFIG.supabase.anonKey
                );

                // Verifica conexão
                const { data, error } = await this.supabase.from('playlist').select('count');
                
                if (!error) {
                    this.initialized = true;
                    Logger.info('Supabase inicializado com sucesso');
                } else {
                    Logger.error('Erro ao conectar com Supabase:', error);
                    this.initialized = false;
                }
            } else {
                throw new Error('Supabase client não carregado');
            }
            
        } catch (error) {
            Logger.error('Erro ao inicializar Supabase:', error);
            this.initialized = false;
        }
    }

    loadSupabaseScript() {
        return new Promise((resolve, reject) => {
            if (window.supabase && window.supabase.createClient) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                // Aguarda um pouco para o script ser processado
                setTimeout(resolve, 100);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Métodos para gerenciar playlist
    async addToPlaylist(item) {
        if (!this.initialized || !this.supabase) {
            Logger.error('Supabase não inicializado');
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('playlist')
                .insert([item])
                .select();

            if (error) throw error;
            Logger.info('Item adicionado à playlist:', data);
            return data;
        } catch (error) {
            Logger.error('Erro ao adicionar item:', error);
            return null;
        }
    }

    async getPlaylist(type = null) {
        if (!this.initialized || !this.supabase) {
            Logger.warn('Supabase não disponível, retornando lista vazia');
            return [];
        }

        try {
            let query = this.supabase
                .from('playlist')
                .select('*')
                .eq('active', true);

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        } catch (error) {
            Logger.error('Erro ao buscar playlist:', error);
            return [];
        }
    }

    async getNextTrack(type = CONFIG.contentTypes.MUSIC) {
        if (!this.initialized || !this.supabase) {
            return this.getDefaultContent(type);
        }

        try {
            const { data, error } = await this.supabase
                .from('playlist')
                .select('*')
                .eq('type', type)
                .eq('active', true)
                .order('play_count', { ascending: true })
                .limit(1);

            if (error) throw error;
            
            if (data && data.length > 0) {
                // Atualiza play count
                await this.updatePlayCount(data[0].id);
                return data[0];
            }
            return null;
        } catch (error) {
            Logger.error('Erro ao buscar próxima faixa:', error);
            return null;
        }
    }

    async updatePlayCount(id) {
        if (!this.initialized || !this.supabase) {
            return;
        }

        try {
            // Primeiro tenta buscar o play_count atual
            const { data: currentData } = await this.supabase
                .from('playlist')
                .select('play_count')
                .eq('id', id)
                .single();
                
            if (currentData) {
                await this.supabase
                    .from('playlist')
                    .update({ play_count: (currentData.play_count || 0) + 1 })
                    .eq('id', id);
            }
        } catch (error) {
            Logger.error('Erro ao atualizar play count:', error);
        }
    }

    async addToHistory(playlistId, listeners = 0) {
        if (!this.initialized || !this.supabase) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('play_history')
                .insert([{
                    playlist_id: playlistId,
                    listeners: listeners
                }]);

            if (error) throw error;
        } catch (error) {
            Logger.error('Erro ao adicionar ao histórico:', error);
        }
    }

    async updateListener(sessionId) {
        if (!this.initialized || !this.supabase) {
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('listeners')
                .upsert([{
                    session_id: sessionId,
                    last_seen: new Date().toISOString()
                }], {
                    onConflict: 'session_id'
                });

            if (error) throw error;
        } catch (error) {
            Logger.error('Erro ao atualizar listener:', error);
        }
    }

    async getActiveListeners() {
        if (!this.initialized || !this.supabase) {
            return 1; // Retorna pelo menos 1 (o usuário atual)
        }

        try {
            // Considera ativo quem foi visto nos últimos 5 minutos
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            
            const { data, error, count } = await this.supabase
                .from('listeners')
                .select('*', { count: 'exact' })
                .gte('last_seen', fiveMinutesAgo);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            Logger.error('Erro ao buscar listeners ativos:', error);
            return 0;
        }
    }

    async getScheduledContent(hour) {
        if (!this.initialized || !this.supabase) {
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('schedule')
                .select(`
                    *,
                    playlist:playlist_id (*)
                `)
                .eq('scheduled_time', `${hour}:00:00`);

            if (error) throw error;
            return data || [];
        } catch (error) {
            Logger.error('Erro ao buscar conteúdo agendado:', error);
            return [];
        }
    }

    async deleteFromPlaylist(id) {
        if (!this.initialized || !this.supabase) {
            Logger.error('Supabase não inicializado');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('playlist')
                .update({ active: false })
                .eq('id', id);

            if (error) throw error;
            Logger.info('Item removido da playlist');
        } catch (error) {
            Logger.error('Erro ao remover item:', error);
        }
    }

    // Busca de conteúdo com fallback para dados locais
    async getContentWithFallback(type) {
        try {
            if (this.initialized && this.supabase) {
                let content = await this.getNextTrack(type);
                
                // Se não houver conteúdo no banco, usa conteúdo padrão
                if (!content) {
                    content = this.getDefaultContent(type);
                }
                
                return content;
            } else {
                return this.getDefaultContent(type);
            }
        } catch (error) {
            Logger.error('Erro ao buscar conteúdo:', error);
            return this.getDefaultContent(type);
        }
    }

    getDefaultContent(type) {
        // Conteúdo padrão para testes
        const defaults = {
            [CONFIG.contentTypes.MUSIC]: {
                title: 'Música de Demonstração',
                artist: 'Artista Demo',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.MUSIC,
                duration: 5
            },
            [CONFIG.contentTypes.AD]: {
                title: 'Propaganda da Rádio',
                artist: 'Patrocinador',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.AD,
                duration: 3
            },
            [CONFIG.contentTypes.ANNOUNCEMENT]: {
                title: 'Aviso Importante',
                artist: 'Sistema',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.ANNOUNCEMENT,
                duration: 2
            },
            [CONFIG.contentTypes.TIME]: {
                title: 'Hora Certa',
                artist: 'Sistema',
                url: CONFIG.defaultAudio.beep,
                type: CONFIG.contentTypes.TIME,
                duration: 3
            }
        };

        return defaults[type] || defaults[CONFIG.contentTypes.MUSIC];
    }

    // Realtime subscriptions
    subscribeToUpdates(callback) {
        if (!this.initialized || !this.supabase) {
            Logger.warn('Supabase não disponível para inscrições realtime');
            return null;
        }

        try {
            const channel = this.supabase.channel('playlist_changes');
            
            channel
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'playlist' },
                    callback
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        Logger.info('Inscrito em mudanças da playlist');
                    }
                });

            return channel;
        } catch (error) {
            Logger.error('Erro ao configurar realtime:', error);
            return null;
        }
    }

    unsubscribe(subscription) {
        if (subscription && this.supabase) {
            this.supabase.removeChannel(subscription);
        }
    }
}

// Instância global
const supabaseManager = new SupabaseManager();
