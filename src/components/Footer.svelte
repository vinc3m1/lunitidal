<script lang="ts">
  import { REPO_URL, LICENSE_URL } from '../lib/links';
</script>

<footer>
  <p>Astronomical tide prediction only — not for navigation.</p>
  <p class="muted">
    Tide data: TICON-4 / UHSLC (CC-BY-4.0) · Forecast: Open-Meteo · Maps: OpenFreeMap / OSM
  </p>
  <p class="muted">
    Made by <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Vince Mi</a>
    · <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
    · <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">MIT License</a>
  </p>
</footer>

<style>
  footer {
    color: var(--muted);
    font-size: 0.78rem;
    text-align: center;
    line-height: 1.5;
  }
  footer p {
    margin: 0.15rem 0;
  }
  footer a {
    color: var(--accent);
    text-decoration: none;
  }
  footer a:hover {
    text-decoration: underline;
  }
</style>
