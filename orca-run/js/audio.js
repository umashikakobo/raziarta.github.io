// === AUDIO.JS - High Quality Shoegaze BGM & Pro SE ===
const AudioManager = {
  initialized:false, bgmPlaying:null, masterVol:null,
  roadParts:{}, bossParts:{}, sePool:{},

  async init() {
    if(this.initialized) return;
    await Tone.start(); this.initialized=true;
    this.masterVol=new Tone.Volume(-5).toDestination();
    const rev=new Tone.Reverb({decay:5,wet:0.4}).connect(this.masterVol);
    const bRev=new Tone.Reverb({decay:2.5,wet:0.25}).connect(this.masterVol);
    const dly=new Tone.FeedbackDelay({delayTime:'8n.',feedback:0.35,wet:0.22}).connect(rev);
    const chr=new Tone.Chorus({frequency:1.2,delayTime:4,depth:0.65,wet:0.3}).connect(rev);
    const dist=new Tone.Distortion({distortion:0.45,wet:0.18}).connect(bRev);
    Tone.Transport.bpm.value=108;

    // === Road BGM ===
    const pad=new Tone.PolySynth(Tone.Synth,{maxPolyphony:8,options:{oscillator:{type:'sine4'},envelope:{attack:1.8,decay:2.5,sustain:0.55,release:3.5},volume:-17}}).connect(chr);
    const padChords=[['F#3','A3','C#4','E4'],['D3','F#3','A3','C#4'],['B2','D3','F#3','A3'],['E3','G#3','B3','D4'],['A2','C#3','E3','G#3'],['F#3','A3','C#4','F#4'],['D3','F#3','B3','D4'],['E3','G#3','B3','E4']];
    const padL=new Tone.Sequence((t,i)=>{pad.triggerAttackRelease(padChords[i],'1m',t,0.35);},[0,1,2,3,4,5,6,7],'1m').start(0);

    // Vocal-like synth (shoegaze voice)
    const vocal=new Tone.Synth({oscillator:{type:'sine8'},envelope:{attack:0.5,decay:1,sustain:0.4,release:2},volume:-14}).connect(new Tone.Vibrato({frequency:5,depth:0.15}).connect(rev));
    const vocNotes=['F#4',null,null,null,'E4',null,null,null,'C#4',null,null,null,'A3',null,null,null,'B3',null,null,null,'C#4',null,'E4',null,'F#4',null,null,null,null,null,null,null];
    const vocL=new Tone.Sequence((t,n)=>{if(n)vocal.triggerAttackRelease(n,'2n',t,0.35)},vocNotes,'4n').start(0);

    const lead=new Tone.Synth({oscillator:{type:'triangle8'},envelope:{attack:0.06,decay:0.35,sustain:0.25,release:1.4},volume:-13}).connect(dly);
    const melNotes=['F#4',null,'E4',null,'C#4',null,'A3',null,'B3',null,'C#4',null,'E4',null,'F#4',null,'A4',null,'G#4',null,'F#4',null,'E4',null,'C#4',null,'D4',null,'E4',null,null,null,'F#4',null,'A4',null,'G#4',null,'E4',null,'F#4',null,'C#4',null,'B3',null,'A3',null,'B3',null,'D4',null,'C#4',null,'E4',null,'F#4',null,null,null,'E4',null,null,null];
    const melL=new Tone.Sequence((t,n)=>{if(n)lead.triggerAttackRelease(n,'8n',t,0.55)},melNotes,'8n').start(0);

    const bass=new Tone.MonoSynth({oscillator:{type:'sine'},envelope:{attack:0.04,decay:0.3,sustain:0.65,release:0.5},filterEnvelope:{attack:0.05,decay:0.2,sustain:0.5,release:0.5,baseFrequency:80,octaves:2.5},volume:-10}).connect(rev);
    const bassN=['F#1',null,'F#1',null,null,'F#1',null,null,'D1',null,'D1',null,null,'D1',null,null,'B0',null,'B0',null,null,'B0',null,null,'E1',null,'E1',null,null,'E1',null,null,'A0',null,'A0',null,null,'A0',null,null,'F#1',null,'F#1',null,null,'F#1',null,null,'D1',null,'D1',null,null,'D1',null,null,'E1',null,'E1',null,'E1',null,null,null];
    const bassL=new Tone.Sequence((t,n)=>{if(n)bass.triggerAttackRelease(n,'4n',t,0.65)},bassN,'8n').start(0);

    const kick=new Tone.MembraneSynth({pitchDecay:0.04,octaves:7,envelope:{attack:0.001,decay:0.28,sustain:0,release:0.25},volume:-7}).connect(rev);
    const snare=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.001,decay:0.13,sustain:0,release:0.08},volume:-13}).connect(rev);
    const hat=new Tone.MetalSynth({frequency:420,envelope:{attack:0.001,decay:0.055,release:0.01},harmonicity:5.1,modulationIndex:32,resonance:4200,octaves:1.5,volume:-21}).connect(rev);
    const drumL=new Tone.Sequence((t,v)=>{if(v==='k')kick.triggerAttackRelease('C1','16n',t,0.65);else if(v==='s')snare.triggerAttackRelease('16n',t,0.35);else if(v==='h')hat.triggerAttackRelease('32n',t,0.22)},['k','h',null,'h','s','h',null,'h','k','h','k','h','s','h',null,'h'],'8n').start(0);

    const noise=new Tone.Noise({type:'pink',volume:-28}).connect(new Tone.AutoFilter({frequency:'2m',baseFrequency:180,octaves:4}).connect(rev).start());
    this.roadParts={loops:[padL,vocL,melL,bassL,drumL],noise,synths:[pad,vocal,lead,bass,kick,snare,hat]};

    // === Boss BGM ===
    const bLead=new Tone.Synth({oscillator:{type:'sawtooth8'},envelope:{attack:0.01,decay:0.12,sustain:0.45,release:0.25},volume:-13}).connect(dist);
    const bBass=new Tone.MonoSynth({oscillator:{type:'sawtooth'},envelope:{attack:0.01,decay:0.18,sustain:0.55,release:0.25},filterEnvelope:{attack:0.02,decay:0.12,sustain:0.35,release:0.25,baseFrequency:55,octaves:3.5},volume:-7}).connect(dist);
    const bKick=new Tone.MembraneSynth({pitchDecay:0.03,octaves:8,envelope:{attack:0.001,decay:0.22,sustain:0,release:0.18},volume:-5}).connect(bRev);
    const bSnare=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.1,sustain:0,release:0.06},volume:-9}).connect(bRev);
    const bLeadN=['A3','A3',null,'C4','E4',null,'A4',null,'G4',null,'E4',null,'C4','D4',null,null,'A3',null,'C4',null,'E4','G4',null,'A4',null,'G4',null,'E4','D4',null,'C4',null];
    const bLeadL=new Tone.Sequence((t,n)=>{if(n)bLead.triggerAttackRelease(n,'16n',t,0.65)},bLeadN,'16n');
    const bBassN=['A1',null,'A1',null,'A1',null,null,'A1','F1',null,'F1',null,'G1',null,null,'G1','A1',null,null,'A1','C2',null,null,'A1','D1',null,'D1',null,'E1',null,'E1',null];
    const bBassL=new Tone.Sequence((t,n)=>{if(n)bBass.triggerAttackRelease(n,'8n',t,0.75)},bBassN,'8n');
    const bDrumL=new Tone.Sequence((t,v)=>{if(v==='k')bKick.triggerAttackRelease('C1','16n',t,0.85);else if(v==='s')bSnare.triggerAttackRelease('16n',t,0.55);else if(v==='b'){bKick.triggerAttackRelease('C1','16n',t,0.65);bSnare.triggerAttackRelease('16n',t,0.25);}},['k',null,'k',null,'s',null,'k',null,'k',null,'k','k','s',null,'b',null],'8n');
    this.bossParts={loops:[bLeadL,bBassL,bDrumL],synths:[bLead,bBass,bKick,bSnare]};

    this.initSE();
  },

  initSE(){
    const sv=new Tone.Volume(-3).toDestination();
    this.sePool={
      shoot:()=>{const s=new Tone.Synth({oscillator:{type:'square'},envelope:{attack:0.001,decay:0.06,sustain:0,release:0.04},volume:-11}).connect(sv);s.triggerAttackRelease('C6','32n');setTimeout(()=>s.dispose(),200);},
      bombShoot:()=>{const s=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:0.01,decay:0.15,sustain:0,release:0.1},volume:-8}).connect(sv);s.triggerAttackRelease('A3','8n');setTimeout(()=>s.dispose(),300);},
      explosion:()=>{const s=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:0.001,decay:0.3,sustain:0.1,release:0.2},volume:-5}).connect(sv);s.triggerAttackRelease('4n');const b=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.2,sustain:0,release:0.1},volume:-6}).connect(sv);b.triggerAttackRelease('C1','8n');setTimeout(()=>{s.dispose();b.dispose();},600);},
      jump:()=>{const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.12,sustain:0,release:0.08},volume:-10}).connect(sv);s.triggerAttackRelease('E5','16n');setTimeout(()=>s.dispose(),200);},
      land:()=>{const s=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:0.001,decay:0.05,sustain:0,release:0.02},volume:-15}).connect(sv);s.triggerAttackRelease('32n');setTimeout(()=>s.dispose(),150);},
      damage:()=>{const s=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.1,sustain:0,release:0.06},volume:-7}).connect(sv);s.triggerAttackRelease('16n');setTimeout(()=>s.dispose(),250);},
      enemyDie:()=>{const s=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:0.001,decay:0.18,sustain:0,release:0.08},volume:-9}).connect(sv);s.triggerAttackRelease('8n');setTimeout(()=>s.dispose(),350);},
      itemGet:()=>{const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.01,decay:0.08,sustain:0.15,release:0.15},volume:-9}).connect(sv);s.triggerAttackRelease('E5','16n');setTimeout(()=>{s.triggerAttackRelease('A5','16n');setTimeout(()=>{s.triggerAttackRelease('C#6','8n');setTimeout(()=>s.dispose(),350);},70);},70);},
      canShoot:()=>{const s=new Tone.MetalSynth({frequency:200,envelope:{attack:0.001,decay:0.04,release:0.01},volume:-17}).connect(sv);s.triggerAttackRelease('32n');setTimeout(()=>s.dispose(),150);},
      bossIntro:()=>{const s=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:0.6,decay:1.2,sustain:0.25,release:1.2},volume:-7}).connect(sv);s.triggerAttackRelease('A1','2n');setTimeout(()=>s.dispose(),3500);},
    };
  },

  playSE(n){if(!this.initialized)return;try{if(this.sePool[n])this.sePool[n]();}catch(e){}},
  startRoadBGM(){if(!this.initialized||this.bgmPlaying==='road')return;this.stopAll();Tone.Transport.bpm.value=108;this.roadParts.loops.forEach(l=>l.start(0));this.roadParts.noise.start();Tone.Transport.start();this.bgmPlaying='road';},
  startBossBGM(){if(!this.initialized||this.bgmPlaying==='boss')return;this.roadParts.loops.forEach(l=>l.stop());if(this.roadParts.noise)this.roadParts.noise.stop();Tone.Transport.bpm.rampTo(144,2);setTimeout(()=>{this.bossParts.loops.forEach(l=>l.start(0));this.bgmPlaying='boss';},500);},
  stopAll(){try{Tone.Transport.stop();this.roadParts.loops?.forEach(l=>l.stop());this.roadParts.noise?.stop();this.bossParts.loops?.forEach(l=>l.stop());this.bgmPlaying=null;}catch(e){}},
};
