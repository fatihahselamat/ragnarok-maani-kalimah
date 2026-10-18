// Multiplayer tanpa jadual database.
// online : Supabase Realtime Broadcast (satu saluran setiap zon)
// local  : BroadcastChannel (antara tab pelayar yang sama, untuk ujian)
// solo   : tiada rangkaian

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('gagal muat ' + src));
    document.head.appendChild(s);
  });
}

export class Net {
  constructor(cfg) {
    this.cfg = cfg;
    this.id = Math.random().toString(36).slice(2, 10);
    this.mode = 'solo';
    this.zone = null;
    this.ready = false;
    this.sb = null;
    this.ch = null;
    this.bc = null;
    this.onMsg = () => {};
    this.onStatus = () => {};
  }

  async init() {
    if (this.cfg.SUPABASE_URL && this.cfg.SUPABASE_ANON_KEY) {
      try {
        await loadScript('./vendor/supabase.js');
        this.sb = window.supabase.createClient(this.cfg.SUPABASE_URL, this.cfg.SUPABASE_ANON_KEY, {
          realtime: { params: { eventsPerSecond: 10 } },
        });
        this.mode = 'online';
        return;
      } catch (e) {
        console.warn(e);
      }
    }
    this.mode = 'BroadcastChannel' in window ? 'local' : 'solo';
  }

  join(zone) {
    this.leave();
    this.zone = zone;
    const name = 'maani-z' + zone;
    if (this.mode === 'online') {
      const ch = this.sb.channel(name, { config: { broadcast: { self: false }, presence: { key: this.id } } });
      ch.on('broadcast', { event: 'p' }, (m) => this.onMsg(m.payload));
      ch.on('presence', { event: 'leave' }, ({ key }) => this.onMsg({ i: key, bye: 1 }));
      ch.on('presence', { event: 'sync' }, () => this.onStatus());
      ch.subscribe((st) => {
        if (st === 'SUBSCRIBED') { ch.track({ t: Date.now() }); this.ready = true; this.onStatus(); }
      });
      this.ch = ch;
    } else if (this.mode === 'local') {
      this.bc = new BroadcastChannel(name);
      this.bc.onmessage = (e) => this.onMsg(e.data);
      this.ready = true;
    }
    this.onStatus();
  }

  send(p) {
    p.i = this.id;
    if (this.mode === 'online') { if (this.ch && this.ready) this.ch.send({ type: 'broadcast', event: 'p', payload: p }); }
    else if (this.bc) this.bc.postMessage(p);
  }

  leave() {
    if (this.ready) this.send({ bye: 1 });
    if (this.ch) { this.sb.removeChannel(this.ch); this.ch = null; }
    if (this.bc) { this.bc.close(); this.bc = null; }
    this.ready = false;
  }
}
