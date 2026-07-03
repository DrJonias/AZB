// small interactive touches for homepage
document.addEventListener('DOMContentLoaded', ()=>{
  const cards = document.querySelectorAll('.card');
  cards.forEach(c=>{
    c.addEventListener('mousemove', e=>{
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `translateY(-6px) rotateX(${y*3}deg) rotateY(${x*3}deg)`;
    });
    c.addEventListener('mouseleave', ()=>{ c.style.transform = '' });
  });

  // Anonymous feedback widget — posts to the zen-garden backend via the
  // nginx /api/ proxy, stored server-side in feedback.jsonl.
  const panel = document.getElementById('fbPanel');
  const status = document.getElementById('fbStatus');
  const text = document.getElementById('fbText');
  if (!panel) return;

  document.getElementById('fbOpen').addEventListener('click', ()=>{
    panel.classList.toggle('hidden');
    status.textContent = '';
    if (!panel.classList.contains('hidden')) text.focus();
  });
  document.getElementById('fbCancel').addEventListener('click', ()=>panel.classList.add('hidden'));

  document.getElementById('fbSend').addEventListener('click', async ()=>{
    const msg = text.value.trim();
    if (msg.length < 3) { status.textContent = 'Please type a few more characters.'; return; }
    status.textContent = 'Sending…';
    try {
      const res = await fetch('api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg, page: location.pathname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      status.textContent = 'Thanks for your feedback! 🙏';
      text.value = '';
      setTimeout(()=>panel.classList.add('hidden'), 1500);
    } catch (err) {
      status.textContent = 'Sending failed: ' + err.message;
    }
  });
});
