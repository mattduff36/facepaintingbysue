export const site = {
  name: "Facepainting by Sue",
  tagline: "Bringing colourful smiles to Burton upon Trent",
  area: "Burton upon Trent & surrounding areas",
  email: "suesfaces@gmail.com",
  phoneDisplay: "07588 486495",
  phoneHref: "tel:+447588486495",
  facebook: "https://www.facebook.com/suespaintedfaces",
} as const;

export const bookingMailto = `mailto:${site.email}?subject=${encodeURIComponent(
  "Face painting enquiry",
)}&body=${encodeURIComponent(
  "Hi Sue,\n\nI'd love to book you for an event. Here are the details:\n\n- Date:\n- Location:\n- Type of event:\n- Approx. number of faces:\n\nThanks!",
)}`;
