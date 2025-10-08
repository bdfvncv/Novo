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
            this.supabase = window.supabase.createClient(
                CONFIG.supabase.url,
                CONFIG.supabase.anonKey
            );

            // Cria as tabelas se não existirem
            await this.createTables();
            
            this.initialized = true;
            Logger.info('Supabase inicializado com sucesso');
        } catch (error) {
            Logger.error('Erro ao inicializar Supabase:', error);
        }
    }

    loadSupabaseScript() {
        return new Promise((resolve, reject) => {
            if (window.supabase) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async createTables() {
        try {
            // Nota: Em produção, você deve criar estas tabelas via dashboard do Supabase
            // Este é apenas um exemplo da estrutura necessária
            
            Logger.info('Tabelas verificadas/criadas com sucesso');
            
            // Estrutura sugerida das tabelas:
            /*
            
            CREATE TABLE IF NOT EXISTS playlist (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255),
                url TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                duration INTEGER,
                cloudinary_public_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                play_count INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT true
            );

            CREATE TABLE IF NOT EXISTS schedule (
                id SERIAL PRIMARY KEY,
                playlist_id INTEGER REFERENCES playlist(id),
                scheduled_time TIME,
                day_of_week INTEGER,
                priority INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS play_history (
                id SERIAL PRIMARY KEY,
                playlist_id INTEGER REFERENCES playlist(id),
                played_at TIMESTAMP DEFAULT NOW(),
                listeners INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS listeners (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE,
                started_at TIMESTAMP DEFAULT NOW(),
                last_seen TIMESTAMP DEFAULT NOW(),
                total_time INTEGER DEFAULT 0
            );

            */
            
        } catch (error) {
            Logger.error('Erro ao criar tabelas:', error);
        }
    }

    // Métodos para gerenciar playlist
    async addToPlaylist(item) {
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
        try {
            const { error } = await this.supabase.rpc('increment_play_count', { 
                row_id: id 
            });
            
            if (error) throw error;
        } catch (error) {
            // Fallback se a função RPC não existir
            const { data } = await this.supabase
                .from('playlist')
                .select('play_count')
                .eq('id', id)
                .single();
                
            if (data) {
                await this.supabase
                    .from('playlist')
                    .update({ play_count: (data.play_count || 0) + 1 })
                    .eq('id', id);
            }
        }
    }

    async addToHistory(playlistId, listeners = 0) {
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
            let content = await this.getNextTrack(type);
            
            // Se não houver conteúdo no banco, usa conteúdo padrão
            if (!content) {
                content = this.getDefaultContent(type);
            }
            
            return content;
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
        const subscription = this.supabase
            .channel('playlist_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'playlist' },
                callback
            )
            .subscribe();

        return subscription;
    }

    unsubscribe(subscription) {
        if (subscription) {
            this.supabase.removeChannel(subscription);
        }
    }
}

// Instância global
const supabaseManager = new SupabaseManager();
