// Configurações da Rádio
const CONFIG = {
    // Supabase Configuration
    supabase: {
        url: 'https://dyzjsgfoaxyeyepoylvg.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I'
    },

    // Cloudinary Configuration
    cloudinary: {
        cloudName: 'dygbrcrr6',
        apiKey: '853591251513134',
        apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
        uploadPreset: 'radio_preset' // Você precisa criar este preset no Cloudinary
    },

    // Configurações da Programação
    programming: {
        // Intervalo entre músicas (em segundos)
        musicInterval: 3,
        
        // Frequência de propagandas (a cada N músicas)
        adFrequency: 3,
        
        // Frequência de avisos (a cada N músicas)
        announcementFrequency: 5,
        
        // Tocar hora certa nas horas cheias
        playTimeAnnouncement: true,
        
        // Volume padrão (0-100)
        defaultVolume: 70,
        
        // Fade in/out duration (ms)
        fadeDuration: 1000
    },

    // Categorias de conteúdo
    contentTypes: {
        MUSIC: 'music',
        AD: 'ad',
        ANNOUNCEMENT: 'announcement',
        TIME: 'time'
    },

    // Mensagens do sistema
    messages: {
        loading: 'Carregando rádio...',
        connectionError: 'Erro de conexão. Tentando reconectar...',
        noContent: 'Nenhum conteúdo disponível no momento',
        uploadSuccess: 'Upload realizado com sucesso!',
        uploadError: 'Erro no upload. Tente novamente.'
    },

    // URLs de áudio padrão (fallback)
    defaultAudio: {
        // Você pode adicionar URLs de áudios padrão aqui
        silence: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        beep: 'data:audio/wav;base64,UklGRiwBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQgBAAAAAAEA/v8CAP//AAABAP//AQABAP7/AQD//wEAAQD+/wIA//8AAAEA//8AAAEA//8BAAAA//8BAAAA//8AAAEA//8AAAEAAAD//wEAAAAAAAAA//8BAAAA//8BAAAA//8AAAEAAAD//wEAAAAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQAAAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA'
    },

    // Configurações de debugging
    debug: {
        enabled: true,
        logLevel: 'info' // 'error', 'warn', 'info', 'debug'
    }
};

// Logger utility
const Logger = {
    error: (msg, data) => {
        if (CONFIG.debug.enabled && ['error', 'warn', 'info', 'debug'].includes(CONFIG.debug.logLevel)) {
            console.error(`[ERRO] ${msg}`, data || '');
        }
    },
    warn: (msg, data) => {
        if (CONFIG.debug.enabled && ['warn', 'info', 'debug'].includes(CONFIG.debug.logLevel)) {
            console.warn(`[AVISO] ${msg}`, data || '');
        }
    },
    info: (msg, data) => {
        if (CONFIG.debug.enabled && ['info', 'debug'].includes(CONFIG.debug.logLevel)) {
            console.info(`[INFO] ${msg}`, data || '');
        }
    },
    debug: (msg, data) => {
        if (CONFIG.debug.enabled && CONFIG.debug.logLevel === 'debug') {
            console.log(`[DEBUG] ${msg}`, data || '');
        }
    }
};
