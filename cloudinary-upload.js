// Cloudinary Upload Manager
class CloudinaryUploader {
    constructor() {
        this.cloudName = CONFIG.cloudinary.cloudName;
        this.apiKey = CONFIG.cloudinary.apiKey;
        this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/upload`;
        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            // Inicializa widget de upload se disponível
            await this.loadCloudinaryWidget();
            this.initialized = true;
            Logger.info('Cloudinary inicializado');
        } catch (error) {
            Logger.warn('Widget Cloudinary não carregado, usando upload direto');
        }
    }

    loadCloudinaryWidget() {
        return new Promise((resolve, reject) => {
            if (window.cloudinary) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://widget.cloudinary.com/v2.0/global/all.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Upload direto via API
    async uploadFile(file, type, metadata = {}) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CONFIG.cloudinary.uploadPreset || 'ml_default');
            formData.append('resource_type', 'audio');
            formData.append('folder', `radio/${type}`);
            
            // Adiciona metadata
            Object.keys(metadata).forEach(key => {
                formData.append(`context[${key}]`, metadata[key]);
            });

            // Tags para organização
            const tags = [type, 'radio', new Date().toISOString().split('T')[0]];
            formData.append('tags', tags.join(','));

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Erro no upload');
            }

            const data = await response.json();
            Logger.info('Upload concluído:', data);

            // Salva no Supabase
            await this.saveToDatabase(data, type, metadata);

            return {
                success: true,
                url: data.secure_url,
                publicId: data.public_id,
                duration: data.duration || 0,
                data: data
            };

        } catch (error) {
            Logger.error('Erro no upload:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Salva informações no banco de dados
    async saveToDatabase(cloudinaryData, type, metadata) {
        try {
            const item = {
                title: metadata.title || cloudinaryData.original_filename || 'Sem título',
                artist: metadata.artist || 'Desconhecido',
                url: cloudinaryData.secure_url,
                type: type,
                duration: Math.round(cloudinaryData.duration || 0),
                cloudinary_public_id: cloudinaryData.public_id,
                active: true
            };

            await supabaseManager.addToPlaylist(item);
            Logger.info('Áudio salvo no banco de dados');

        } catch (error) {
            Logger.error('Erro ao salvar no banco:', error);
        }
    }

    // Upload múltiplo
    async uploadMultiple(files, type, onProgress) {
        const results = [];
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: total,
                    percentage: Math.round(((i + 1) / total) * 100),
                    fileName: file.name
                });
            }

            // Extrai metadata do nome do arquivo
            const metadata = this.extractMetadata(file.name);
            
            const result = await this.uploadFile(file, type, metadata);
            results.push(result);
        }

        return results;
    }

    // Extrai informações do nome do arquivo
    extractMetadata(filename) {
        // Remove extensão
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        
        // Tenta identificar padrão "Artista - Título"
        const parts = nameWithoutExt.split(' - ');
        
        if (parts.length >= 2) {
            return {
                artist: parts[0].trim(),
                title: parts[1].trim()
            };
        }
        
        return {
            title: nameWithoutExt,
            artist: 'Desconhecido'
        };
    }

    // Widget de upload (se disponível)
    openUploadWidget(options, callback) {
        if (!window.cloudinary) {
            Logger.error('Widget Cloudinary não disponível');
            return;
        }

        const widget = window.cloudinary.createUploadWidget(
            {
                cloudName: this.cloudName,
                uploadPreset: CONFIG.cloudinary.uploadPreset || 'ml_default',
                resourceType: 'audio',
                folder: `radio/${options.type || 'music'}`,
                multiple: true,
                maxFiles: 10,
                maxFileSize: 50000000, // 50MB
                clientAllowedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
                theme: 'dark',
                language: 'pt',
                text: {
                    'pt': {
                        or: 'Ou',
                        back: 'Voltar',
                        advanced: 'Avançado',
                        close: 'Fechar',
                        no_results: 'Nenhum resultado',
                        search_placeholder: 'Buscar arquivos',
                        about_uw: 'Sobre o Upload Widget',
                        menu: {
                            files: 'Meus Arquivos',
                            web: 'Endereço Web',
                            camera: 'Câmera',
                            gsearch: 'Busca de Imagem',
                            gdrive: 'Google Drive',
                            dropbox: 'Dropbox',
                            facebook: 'Facebook',
                            instagram: 'Instagram'
                        },
                        local: {
                            browse: 'Procurar',
                            dd_title_single: 'Arraste e solte um arquivo aqui',
                            dd_title_multi: 'Arraste e solte arquivos aqui',
                            drop_title_single: 'Solte o arquivo para fazer upload',
                            drop_title_multiple: 'Solte os arquivos para fazer upload'
                        }
                    }
                },
                ...options
            },
            async (error, result) => {
                if (error) {
                    Logger.error('Erro no widget:', error);
                    callback && callback(error, null);
                    return;
                }

                if (result.event === 'success') {
                    // Salva no banco
                    await this.saveToDatabase(
                        result.info,
                        options.type || CONFIG.contentTypes.MUSIC,
                        {
                            title: result.info.original_filename,
                            artist: 'Upload via Widget'
                        }
                    );
                    
                    callback && callback(null, result.info);
                }
            }
        );

        widget.open();
        return widget;
    }

    // Deleta arquivo do Cloudinary
    async deleteFile(publicId) {
        try {
            // Nota: Delete via API requer assinatura server-side
            // Em produção, faça isso através de uma API backend
            Logger.warn('Delete deve ser feito via backend seguro');
            return false;
        } catch (error) {
            Logger.error('Erro ao deletar:', error);
            return false;
        }
    }

    // Busca arquivos no Cloudinary
    async searchFiles(type, query = '') {
        try {
            // Nota: Search via API requer autenticação
            // Em produção, faça isso através de uma API backend
            Logger.warn('Search deve ser feito via backend seguro');
            
            // Por enquanto, busca no Supabase
            return await supabaseManager.getPlaylist(type);
        } catch (error) {
            Logger.error('Erro na busca:', error);
            return [];
        }
    }
}

// Instância global
const cloudinaryUploader = new CloudinaryUploader();
