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
});
