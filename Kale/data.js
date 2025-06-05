export const users = [
  {
    id: 1,
    name: 'Big Bird',
    avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png',
    bio: 'Just a friendly bird trying to make his way in the world. Loves sunny days and learning new things!',
    stories: [
      { id: 101, uri: 'https://picsum.photos/seed/bigbird-story1/700/700' },
      { id: 102, uri: 'https://picsum.photos/seed/bigbird-story2/700/700' },
      { id: 103, uri: 'https://picsum.photos/seed/bigbird-story3/700/700' },
    ],
    following: [2, 3, 5],
  },
  {
    id: 2,
    name: 'Elmo',
    avatar: 'https://randomuser.me/api/portraits/lego/1.jpg',
    bio: 'Elmo loves to play and make new friends! Thank you for visiting Elmo\'s profile!',
    stories: [
        { id: 201, uri: 'https://picsum.photos/seed/elmo-story1/700/700' },
        { id: 202, uri: 'https://picsum.photos/seed/elmo-story2/700/700' },
    ]
  },
  {
    id: 3,
    name: 'Cookie Monster',
    avatar: 'https://randomuser.me/api/portraits/lego/2.jpg',
    bio: 'Me love cookies! Me also love friends! Om nom nom nom.',
    stories: [
        { id: 301, uri: 'https://picsum.photos/seed/cookie-story1/700/700' },
        { id: 302, uri: 'https://picsum.photos/seed/cookie-story2/700/700' },
        { id: 303, uri: 'https://picsum.photos/seed/cookie-story3/700/700' },
        { id: 304, uri: 'https://picsum.photos/seed/cookie-story4/700/700' },
    ]
  },
  {
    id: 4,
    name: 'Oscar',
    avatar: 'https://randomuser.me/api/portraits/lego/3.jpg',
    bio: 'Scram! Go away! I like being grumpy in my trash can. Don\'t expect any smiles here.',
    stories: [
        { id: 401, uri: 'https://picsum.photos/seed/oscar-story1/700/700' },
    ]
  },
  {
    id: 5,
    name: 'Grover',
    avatar: 'https://randomuser.me/api/portraits/lego/4.jpg',
    bio: 'Your furry pal, your cute and lovable pal! I am a monster who is super-duper!',
    stories: [
        { id: 501, uri: 'https://picsum.photos/seed/grover-story1/700/700' },
        { id: 502, uri: 'https://picsum.photos/seed/grover-story2/700/700' },
    ]
  },
  {
    id: 6,
    name: 'Bert',
    avatar: 'https://randomuser.me/api/portraits/lego/5.jpg',
    bio: 'Enthusiast of pigeons and bottle caps. I enjoy peace, quiet, and argyle socks.',
    stories: [
        { id: 601, uri: 'https://picsum.photos/seed/bert-story1/700/700' },
        { id: 602, uri: 'https://picsum.photos/seed/bert-story2/700/700' },
    ]
  },
  {
    id: 7,
    name: 'Ernie',
    avatar: 'https://randomuser.me/api/portraits/lego/6.jpg',
    bio: 'Rubber Ducky, you\'re the one! I love baths, playing the saxophone, and my best friend Bert!',
     stories: [
        { id: 701, uri: 'https://picsum.photos/seed/ernie-story1/700/700' },
        { id: 702, uri: 'https://picsum.photos/seed/ernie-story2/700/700' },
    ]
  },
  {
    id: 8,
    name: 'Zoe',
    avatar: 'https://randomuser.me/api/portraits/lego/7.jpg',
    bio: 'I love to dance and play with Rocco! Ooh ooh ooh!',
    stories: [
        { id: 801, uri: 'https://picsum.photos/seed/zoe-story1/700/700' },
    ]
  },
  {
    id: 9,
    name: 'Abby Cadabby',
    avatar: 'https://randomuser.me/api/portraits/lego/8.jpg',
    bio: 'Learning to fly and making magic! Everything is abracadabra!',
    stories: [
        { id: 901, uri: 'https://picsum.photos/seed/abby-story1/700/700' },
        { id: 902, uri: 'https://picsum.photos/seed/abby-story2/700/700' },
    ]
  },
  {
    id: 10,
    name: 'Rosita',
    avatar: 'https://randomuser.me/api/portraits/lego/9.jpg',
    bio: 'Hola! I love playing my guitar and singing songs in English and Spanish!',
     stories: [
        { id: 1001, uri: 'https://picsum.photos/seed/rosita-story1/700/700' },
    ]
  },
  {
    id: 11,
    name: 'Count von Count',
    avatar: 'https://randomuser.me/api/portraits/lego/10.jpg',
    bio: 'Greetings! I love to count things! One, two, three...ah-ha-ha!',
     stories: [
        { id: 1101, uri: 'https://picsum.photos/seed/count-story1/700/700' },
    ]
  },
  {
    id: 12,
    name: 'Snuffy',
    avatar: 'https://randomuser.me/api/portraits/lego/11.jpg',
    bio: 'Snuffleupagus is my full name. I like to play hide-and-seek, but sometimes nobody sees me!',
     stories: [
        { id: 1201, uri: 'https://picsum.photos/seed/snuffy-story1/700/700' },
    ]
  },
  {
    id: 13,
    name: 'Kermit the Frog',
    avatar: 'https://randomuser.me/api/portraits/thumb/men/1.jpg',
    bio: 'It\'s not easy being green. Host of The Muppet Show and general amphibian.',
    stories: [
        { id: 1301, uri: 'https://picsum.photos/seed/kermit-story1/700/700' },
        { id: 1302, uri: 'https://picsum.photos/seed/kermit-story2/700/700' },
    ]
  },
  {
    id: 14,
    name: 'Miss Piggy',
    avatar: 'https://randomuser.me/api/portraits/thumb/women/1.jpg',
    bio: 'Moi! A true star, darling. Fashion icon, singer, and pig of perfection.',
     stories: [
        { id: 1401, uri: 'https://picsum.photos/seed/piggy-story1/700/700' },
    ]
  },
];

export const posts = [
  {
    id: 1,
    user: { id: 1, name: 'Big Bird', avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png' },
    date: 'May 28',
    imageUri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
    commentsCount: 18,
  },
  {
    id: 2,
    user: { id: 2, name: 'Elmo', avatar: 'https://randomuser.me/api/portraits/lego/1.jpg' },
    date: 'May 27',
    imageUri: 'https://picsum.photos/seed/elmo1/700/700',
    commentsCount: 10,
  },
  {
    id: 3,
    user: { id: 3, name: 'Cookie Monster', avatar: 'https://randomuser.me/api/portraits/lego/2.jpg' },
    date: 'May 27',
    imageUri: 'https://picsum.photos/seed/cookie1/700/700',
    commentsCount: 25,
  },
   {
    id: 4,
    user: { id: 1, name: 'Big Bird', avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png' },
    date: 'May 25',
    imageUri: 'https://picsum.photos/seed/bigbird2/700/700',
    commentsCount: 15,
  },
  {
    id: 5,
    user: { id: 4, name: 'Oscar', avatar: 'https://randomuser.me/api/portraits/lego/3.jpg' },
    date: 'May 24',
    imageUri: 'https://picsum.photos/seed/oscar1/700/700',
    commentsCount: 7,
  },
  {
    id: 6,
    user: { id: 5, name: 'Grover', avatar: 'https://randomuser.me/api/portraits/lego/4.jpg' },
    date: 'May 23',
    imageUri: 'https://picsum.photos/seed/grover1/700/700',
    commentsCount: 14,
  },
  {
    id: 7,
    user: { id: 1, name: 'Big Bird', avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png' },
    date: 'May 22',
    imageUri: 'https://picsum.photos/seed/bigbird3/700/700',
    commentsCount: 20,
  },
  {
    id: 8,
    user: { id: 6, name: 'Bert', avatar: 'https://randomuser.me/api/portraits/lego/5.jpg' },
    date: 'May 21',
    imageUri: 'https://picsum.photos/seed/bert1/700/700',
    commentsCount: 9,
  },
  {
    id: 9,
    user: { id: 7, name: 'Ernie', avatar: 'https://randomuser.me/api/portraits/lego/6.jpg' },
    date: 'May 20',
    imageUri: 'https://picsum.photos/seed/ernie1/700/700',
    commentsCount: 11,
  },
  {
    id: 10,
    user: { id: 2, name: 'Elmo', avatar: 'https://randomuser.me/api/portraits/lego/1.jpg' },
    date: 'May 19',
    imageUri: 'https://picsum.photos/seed/elmo2/700/700',
    commentsCount: 13,
  },
   {
    id: 11,
    user: { id: 1, name: 'Big Bird', avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png' },
    date: 'May 18',
    imageUri: 'https://picsum.photos/seed/bigbird4/700/700',
    commentsCount: 8,
  },
  {
    id: 12,
    user: { id: 8, name: 'Zoe', avatar: 'https://randomuser.me/api/portraits/lego/7.jpg' },
    date: 'May 17',
    imageUri: 'https://picsum.photos/seed/zoe1/700/700',
    commentsCount: 16,
  },
  {
    id: 13,
    user: { id: 9, name: 'Abby Cadabby', avatar: 'https://randomuser.me/api/portraits/lego/8.jpg' },
    date: 'May 16',
    imageUri: 'https://picsum.photos/seed/abby1/700/700',
    commentsCount: 10,
  },
  {
    id: 14,
    user: { id: 10, name: 'Rosita', avatar: 'https://randomuser.me/api/portraits/lego/9.jpg' },
    date: 'May 15',
    imageUri: 'https://picsum.photos/seed/rosita1/700/700',
    commentsCount: 12,
  },
  {
    id: 15,
    user: { id: 11, name: 'Count von Count', avatar: 'https://randomuser.me/api/portraits/lego/10.jpg' },
    date: 'May 14',
    imageUri: 'https://picsum.photos/seed/count1/700/700',
    commentsCount: 15,
  },
  {
    id: 16,
    user: { id: 12, name: 'Snuffy', avatar: 'https://randomuser.me/api/portraits/lego/11.jpg' },
    date: 'May 13',
    imageUri: 'https://picsum.photos/seed/snuffy1/700/700',
    commentsCount: 6,
  },
   {
    id: 17,
    user: { id: 1, name: 'Big Bird', avatar: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird-560x420.png' },
    date: 'May 12',
    imageUri: 'https://picsum.photos/seed/bigbird5/700/700',
    commentsCount: 19,
  },
  {
    id: 18,
    user: { id: 13, name: 'Kermit the Frog', avatar: 'https://randomuser.me/api/portraits/thumb/men/1.jpg' },
    date: 'May 11',
    imageUri: 'https://picsum.photos/seed/kermit1/700/700',
    commentsCount: 22,
  },
  {
    id: 19,
    user: { id: 14, name: 'Miss Piggy', avatar: 'https://randomuser.me/api/portraits/thumb/women/1.jpg' },
    date: 'May 10',
    imageUri: 'https://picsum.photos/seed/piggy1/700/700',
    commentsCount: 28,
  },
]; 