export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  epgNow?: string;
  streamCandidates?: string[];
}

export interface VodItem {
  id: string;
  name: string;
  poster: string;
  rating: number;
  year: number;
  genre: string;
  type: "movie" | "series";
  streamUrl?: string;
  synopsis?: string;
  trailerUrl?: string;
  duration?: string;
  cast?: string;
  director?: string;
}

export const liveChannels: Channel[] = [
  { id: "1", name: "Globo HD", logo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=80&h=80&fit=crop", group: "Abertos", url: "", epgNow: "Jornal Nacional" },
  { id: "2", name: "SBT HD", logo: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=80&h=80&fit=crop", group: "Abertos", url: "", epgNow: "Programa do Ratinho" },
  { id: "3", name: "Record HD", logo: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=80&h=80&fit=crop", group: "Abertos", url: "", epgNow: "Cidade Alerta" },
  { id: "4", name: "ESPN Brasil", logo: "https://images.unsplash.com/photo-1461896836934-bd45ba7e7e7d?w=80&h=80&fit=crop", group: "Esportes", url: "", epgNow: "SportsCenter" },
  { id: "5", name: "Fox Sports", logo: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=80&h=80&fit=crop", group: "Esportes", url: "", epgNow: "Futebol ao Vivo" },
  { id: "6", name: "HBO", logo: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=80&h=80&fit=crop", group: "Filmes", url: "", epgNow: "The Last of Us" },
  { id: "7", name: "TNT", logo: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=80&h=80&fit=crop", group: "Filmes", url: "", epgNow: "Filme em Exibição" },
  { id: "8", name: "Discovery", logo: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=80&fit=crop", group: "Documentários", url: "", epgNow: "Planeta Terra" },
  { id: "9", name: "National Geographic", logo: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=80&fit=crop", group: "Documentários", url: "", epgNow: "Cosmos" },
  { id: "10", name: "Cartoon Network", logo: "https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=80&h=80&fit=crop", group: "Infantil", url: "", epgNow: "Hora de Aventura" },
];

export const movies: VodItem[] = [
  { id: "m1", name: "Oppenheimer", poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=300&h=450&fit=crop", rating: 8.5, year: 2023, genre: "Drama", type: "movie" },
  { id: "m2", name: "Dune: Part Two", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&h=450&fit=crop", rating: 8.8, year: 2024, genre: "Sci-Fi", type: "movie" },
  { id: "m3", name: "The Batman", poster: "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=300&h=450&fit=crop", rating: 7.8, year: 2022, genre: "Ação", type: "movie" },
  { id: "m4", name: "Interstellar", poster: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=300&h=450&fit=crop", rating: 8.7, year: 2014, genre: "Sci-Fi", type: "movie" },
  { id: "m5", name: "Gladiador II", poster: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=300&h=450&fit=crop", rating: 7.2, year: 2024, genre: "Ação", type: "movie" },
  { id: "m6", name: "Pobres Criaturas", poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=450&fit=crop", rating: 8.0, year: 2023, genre: "Drama", type: "movie" },
  { id: "m7", name: "Killers of the Flower Moon", poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=450&fit=crop", rating: 7.9, year: 2023, genre: "Drama", type: "movie" },
  { id: "m8", name: "Top Gun: Maverick", poster: "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=300&h=450&fit=crop", rating: 8.3, year: 2022, genre: "Ação", type: "movie" },
];

export const series: VodItem[] = [
  { id: "s1", name: "The Last of Us", poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=450&fit=crop", rating: 8.8, year: 2023, genre: "Drama", type: "series" },
  { id: "s2", name: "House of the Dragon", poster: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=450&fit=crop", rating: 8.4, year: 2022, genre: "Fantasia", type: "series" },
  { id: "s3", name: "Shogun", poster: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=300&h=450&fit=crop", rating: 9.0, year: 2024, genre: "Drama", type: "series" },
  { id: "s4", name: "Severance", poster: "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=300&h=450&fit=crop", rating: 8.7, year: 2022, genre: "Thriller", type: "series" },
  { id: "s5", name: "Fallout", poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&h=450&fit=crop", rating: 8.5, year: 2024, genre: "Sci-Fi", type: "series" },
  { id: "s6", name: "3 Body Problem", poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=450&fit=crop", rating: 7.6, year: 2024, genre: "Sci-Fi", type: "series" },
];

export const categories = [
  { id: "live", label: "Canais ao Vivo", count: liveChannels.length },
  { id: "movies", label: "Filmes", count: movies.length },
  { id: "series", label: "Séries", count: series.length },
];
