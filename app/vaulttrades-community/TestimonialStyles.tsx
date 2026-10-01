export default function TestimonialStyles() {
  return (
    <style jsx global>{`
      .vt-testimonials-section{padding:90px 0}
      .vt-testimonials-intro{max-width:760px;color:#8f9bae;font-size:14px;line-height:1.7;margin:-10px 0 30px}
      .vt-testimonials-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:28px}
      .vt-testimonial{background:#0a101c;border:1px solid rgba(212,166,55,.18);border-radius:12px;padding:24px;min-height:220px;display:flex;flex-direction:column}
      .vt-testimonial-mark{color:#d4a637;font-size:42px;line-height:.8;font-family:Georgia,serif}
      .vt-testimonial p{color:#d7dce5;font-size:14px;line-height:1.75;margin:16px 0 24px;flex:1}
      .vt-testimonial-author{border-top:1px solid #1d2837;padding-top:14px;display:flex;flex-direction:column;gap:4px}
      .vt-testimonial-author strong{font-size:12px;color:#f5f7fb}
      .vt-testimonial-author span{font-size:10px;color:#697588;letter-spacing:.06em;text-transform:uppercase}
      .vt-testimonials-empty{border:1px dashed rgba(212,166,55,.25);border-radius:12px;padding:28px;background:#0a101c;display:flex;flex-direction:column;gap:8px;color:#cbd2dd}
      .vt-testimonials-empty span{color:#7f8b9f;font-size:13px}
      .vt-testimonial-submit{display:grid;grid-template-columns:.8fr 1.2fr;gap:28px;margin-top:34px;padding:28px;border:1px solid rgba(212,166,55,.2);border-radius:14px;background:#080f1a}
      .vt-testimonial-submit h3{font-size:22px;margin:12px 0}
      .vt-testimonial-submit p{color:#8f9bae;font-size:13px;line-height:1.7;margin:0}
      .vt-testimonial-form textarea{width:100%;resize:vertical;min-height:150px;background:#050812;color:#f4f6fb;border:1px solid #273346;border-radius:10px;padding:14px;outline:none;font:inherit;font-size:13px;line-height:1.6}
      .vt-testimonial-form textarea:focus{border-color:#d4a637}
      .vt-testimonial-form-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;color:#687489;font-size:10px}
      .vt-testimonial-button{border:0;cursor:pointer}
      .vt-testimonial-button:disabled{opacity:.45;cursor:not-allowed}
      .vt-testimonial-status{margin-top:10px;color:#d4a637;font-size:12px;line-height:1.5}
      .vt-testimonial-gate{border:1px solid rgba(212,166,55,.18);border-radius:10px;background:#0a101c;padding:22px}
      .vt-testimonial-gate strong{font-size:14px}
      .vt-testimonial-gate p{margin:8px 0 4px}
      @media(max-width:900px){
        .vt-testimonials-grid{grid-template-columns:1fr 1fr}
        .vt-testimonial-submit{grid-template-columns:1fr}
      }
      @media(max-width:520px){
        .vt-testimonials-grid{grid-template-columns:1fr}
        .vt-testimonial-submit{padding:20px}
      }
    `}</style>
  );
}
