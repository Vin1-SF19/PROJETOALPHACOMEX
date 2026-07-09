export interface BancoCatalogo {
  id: string;
  nome: string;
  logo: string;
}

export const BANCOS_CATALOGO: BancoCatalogo[] = [
  { id: "itauC", nome: "Itaú - Consolidado", logo: "https://assets.hgbrasil.com/finance/companies/big/itauunibanco.png" },
  { id: "itau", nome: "Itaú", logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGsT3SsiVHEr22i0zROsQdDulrZn44Fg3FTA&s" },
  { id: "bradesco", nome: "Bradesco", logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT76Y8Kg3vkr8pHetdO3ELHzbU9OcaN-YtxQw&s" },
  { id: "nubank", nome: "Nubank", logo: "https://s3.amazonaws.com//beta-img.b2bstack.net/uploads/production/provider/image/36/o2hFZ2Wc.png" },
  { id: "sicredi", nome: "Sicredi", logo: "https://yt3.googleusercontent.com/ytc/AIdro_mX0Dsx4mnkCSatUSSs_1X64KqC3LTAbyQrLo-aK3qaC-0=s900-c-k-c0x00ffffff-no-rj" },
  { id: "santander", nome: "Santander", logo: "https://play-lh.googleusercontent.com/g_QDzrOlw8Belx8qb47fUu0MPL6AVFzDdbOz_NJZYQDNLveHYxwiUoe09Wvkxf-_548q" },
  { id: "bancoBrasil", nome: "Banco do Brasil", logo: "https://s3.amazonaws.com//beta-img.b2bstack.net/uploads/production/product/product_image/26449/banco-brasil-logo.png" },
  { id: "sicoob", nome: "Sicoob", logo: "https://scontent.fnvt10-1.fna.fbcdn.net/v/t1.6435-9/64664519_2511764435542395_2898771194410958848_n.png?_nc_cat=111&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=_dbbpUT_UZgQ7kNvwGMJp6b&_nc_oc=AdrA_gLfY-NeWDDcNPYHpOB91rW38jvjV1OwuisnvkGYiBG_hLANhXJWChgq8DgQ2cU&_nc_zt=23&_nc_ht=scontent.fnvt10-1.fna&_nc_gid=m7SikjtuFKqpMg5Y8-IFJQ&_nc_ss=7a30f&oh=00_AfwYcQQ3hzmjBWxcpAiw5s6fq49YUqzqeE8GyE0lJhDDOQ&oe=69EA36E2" },
  { id: "bancoPan", nome: "Banco Pan", logo: "https://www.bancopan.com.br/content/dam/webapp--aem-institucional-blog/categorias/banner_mobile.webp" },
  { id: "mercadoPago", nome: "Mercado Pago", logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSC5OnfdoTXarZCpxiEFB0yNmSI3ZX_dMxUdQ&s" },
  { id: "pagBank", nome: "Pag Bank", logo: "https://play-lh.googleusercontent.com/O9GpqGB-9aE8Qt79JM1VXoVA5rRQjLb4LVk7yVwd2cuWeAi0ML6uVbc7aXZEOeyYwg=s256-rw" },
  { id: "c6", nome: "C6 Bank", logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRP1k3xiZGECxPYfI1HB9NAwNIOFcrJ7Y9K5w&s" },
  { id: "inter", nome: "Inter", logo: "https://media.licdn.com/dms/image/v2/D4D05AQFD2dx4DqQ-0w/videocover-high/videocover-high/0/1691499408584?e=2147483647&v=beta&t=rrL0MG7xNh8CQHxE28-z039goMj2ljvXyd1dYnXkFyI" },
  { id: "credcrea", nome: "CredCrea", logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLnKtHqFm_6MU1xUj-d4w_ArqWxdn7Wlw-Gw&s" },
  { id: "caixa", nome: "Caixa", logo: "https://pbs.twimg.com/profile_images/1760094261775572992/_U76QhK9.jpg" },
];

export function buscarBancoPorId(id: string): BancoCatalogo | undefined {
  return BANCOS_CATALOGO.find((b) => b.id === id);
}
