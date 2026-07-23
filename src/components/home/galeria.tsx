import Image from "next/image";

const galeria = [
  { src: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=800", alt: "Hamburguesa artesanal doble", big: true },
  { src: "https://images.unsplash.com/photo-1550317138-10000687a72b?q=80&w=600", alt: "Perro caliente artesanal" },
  { src: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?q=80&w=600", alt: "Papas a la francesa" },
  { src: "https://images.unsplash.com/photo-1610614819513-58e34989e371?q=80&w=600", alt: "Carne a la parrilla" },
];

export function Galeria() {
  return (
    <section className="bg-charcoal-50 py-24 dark:bg-charcoal-800/40">
      <div className="container-lm">
        <p className="eyebrow mb-3 text-center">Galería</p>
        <h2 className="mx-auto max-w-xl text-center font-display text-4xl leading-tight tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
          ASÍ SE VE UNA MORDIDA
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-2">
          {galeria.map((img, i) => (
            <div
              key={img.alt}
              className={`relative overflow-hidden rounded-2xl ${
                img.big ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"
              }`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover transition-transform duration-500 hover:scale-110"
                sizes="(max-width: 768px) 50vw, 25vw"
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
