export function App() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <span className="wordmark">Memofreq</span>
        <span className="project-stage">Em desenvolvimento</span>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <section aria-labelledby="titulo">
          <p className="eyebrow">Percepção e memória auditiva</p>
          <h1 id="titulo">Memofreq</h1>
          <p className="introduction">
            Ouça um tom, guarde na memória e tente encontrá-lo novamente.
          </p>
          <p>
            O jogo está em construção. Em breve, você poderá desafiar sua
            memória nos modos Normal, Hard e Extreme.
          </p>
        </section>
        <aside className="listening-note" aria-labelledby="fones">
          <h2 id="fones">Coloque seus fones de ouvido!</h2>
          <p>
            Para uma experiência mais precisa, recomendamos utilizar fones de
            ouvido e jogar em um ambiente silencioso. Ajuste o volume para um
            nível confortável antes de começar.
          </p>
        </aside>
      </main>
      <footer>Um desafio para os seus ouvidos.</footer>
    </>
  );
}
