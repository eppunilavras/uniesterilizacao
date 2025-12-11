/**
 * Sistema de Feedback Sonoro (Bips) usando Web Audio API.
 * Gera sons sintéticos para sucesso e erro, evitando arquivos de áudio externos.
 */
export const playSound = (type) => {
    try {
        // Garante compatibilidade com navegadores (Webkit/Standard)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'success') {
            // SOM DE SUCESSO (Tom ascendente agudo)
            // Frequência: 880Hz -> 1760Hz
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
            
            // Envelope de Volume (Fade out rápido)
            gain.gain.setValueAtTime(1.0, ctx.currentTime); 
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.3);

        } else if (type === 'error') {
            // SOM DE ERRO "AGRADÁVEL" (Soft Thud)
            // Onda suave (sine) em vez de serra (sawtooth) para não ser irritante
            osc.type = 'sine'; 
            
            // Começa num tom médio-grave (300Hz) e cai rápido para grave (50Hz)
            // Isso cria um efeito de "Tump" ou "Bloop" negativo
            osc.frequency.setValueAtTime(300, ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
            
            // Volume começa alto e some rápido
            gain.gain.setValueAtTime(1.0, ctx.currentTime);       
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {
        console.error("Erro ao reproduzir som:", e);
    }
};