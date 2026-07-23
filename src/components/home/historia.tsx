export function Historia() {
  const pasos = [
    {
      title: "La carne",
      text: "Molida a diario, sin conservantes, con un blend propio de cortes que le da jugosidad a cada mordida.",
    },
    {
      title: "El pan",
      text: "Horneado en casa, brioche suave por fuera y firme por dentro para aguantar cada capa de ingredientes.",
    },
    {
      title: "El fuego",
      text: "Cocinamos a la parrilla para sellar el sabor y dejar ese toque ahumado que nos distingue.",
    },
  ];

  return (
    <section id="historia" className="container-lm py-24">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow mb-3">Nuestra historia</p>
          <h2 className="font-display text-4xl leading-tight tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
            NACIMOS DE LAS GANAS DE HACER
            <span className="text-ember-600"> LO ARTESANAL, BIEN.</span>
          </h2>
          <p className="mt-6 text-charcoal-500 dark:text-charcoal-200">
            La Mordida empezó como un carrito de barrio con una idea simple: nada de congelados, nada de atajos.
            Solo carne fresca, pan recién horneado y las manos de nuestro equipo armando cada hamburguesa y cada
            perro caliente como si fuera para su propia familia. Hoy seguimos igual, solo que con más mesas y más
            mordidas por repartir.
          </p>
        </div>

        <div className="space-y-4">
          {pasos.map((paso, i) => (
            <div
              key={paso.title}
              className="flex gap-5 rounded-2xl border border-charcoal-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800"
            >
              <span className="font-mono text-sm text-ember-500">0{i + 1}</span>
              <div>
                <h3 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{paso.title}</h3>
                <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">{paso.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
