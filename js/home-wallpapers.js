/* =========================================================================
   首页「介绍页卡片」的随机动态壁纸池（Doggie Corgi 03 系列，41 条）
   -------------------------------------------------------------------------
   卡片小图只显示这里的 poster（首帧图，静态）；
   视频 src 只在你点全屏时才真正加载播放 —— 所以切卡片永远不可能串帧，
   也不会为了看一眼卡片去下 3MB 视频。

   发牌用「洗牌袋」：一轮内 41 条各发一次，不会连续重复，
   也不会出现某几条永远抽不到。发完一轮重新洗。

   追加新素材：转好 vid/corgi-42.mp4 + corgi-42.jpg，在末尾加一条即可，
   然后在站点根目录跑一次 python _stamp_version.py（自动补 ?v= 内容哈希）。
   ========================================================================= */
(function(){
    var pool=[
        {src:"./vid/corgi-01.mp4?v=d7af0200", poster:"./vid/corgi-01.jpg?v=b7138b61"},
        {src:"./vid/corgi-02.mp4?v=644633d9", poster:"./vid/corgi-02.jpg?v=38404518"},
        {src:"./vid/corgi-03.mp4?v=593c1b15", poster:"./vid/corgi-03.jpg?v=44398381"},
        {src:"./vid/corgi-04.mp4?v=d6505087", poster:"./vid/corgi-04.jpg?v=3aad5cec"},
        {src:"./vid/corgi-05.mp4?v=06786121", poster:"./vid/corgi-05.jpg?v=aaefc93a"},
        {src:"./vid/corgi-06.mp4?v=5f67415d", poster:"./vid/corgi-06.jpg?v=4c3d34ea"},
        {src:"./vid/corgi-07.mp4?v=66fac465", poster:"./vid/corgi-07.jpg?v=50a4a15a"},
        {src:"./vid/corgi-08.mp4?v=6b5aae71", poster:"./vid/corgi-08.jpg?v=2200e918"},
        {src:"./vid/corgi-09.mp4?v=1ec15d75", poster:"./vid/corgi-09.jpg?v=fdf304b0"},
        {src:"./vid/corgi-10.mp4?v=50d1cd9a", poster:"./vid/corgi-10.jpg?v=71a6ceef"},
        {src:"./vid/corgi-11.mp4?v=38ee5d49", poster:"./vid/corgi-11.jpg?v=a65095df"},
        {src:"./vid/corgi-12.mp4?v=fdced59d", poster:"./vid/corgi-12.jpg?v=e1241369"},
        {src:"./vid/corgi-13.mp4?v=6d4a240f", poster:"./vid/corgi-13.jpg?v=883cb520"},
        {src:"./vid/corgi-14.mp4?v=9a152006", poster:"./vid/corgi-14.jpg?v=39932144"},
        {src:"./vid/corgi-15.mp4?v=87054548", poster:"./vid/corgi-15.jpg?v=d2b1586e"},
        {src:"./vid/corgi-16.mp4?v=72c93e2a", poster:"./vid/corgi-16.jpg?v=8f37995d"},
        {src:"./vid/corgi-17.mp4?v=ea174713", poster:"./vid/corgi-17.jpg?v=5e55fc1e"},
        {src:"./vid/corgi-18.mp4?v=7db2aacc", poster:"./vid/corgi-18.jpg?v=396ba4af"},
        {src:"./vid/corgi-19.mp4?v=85ae5694", poster:"./vid/corgi-19.jpg?v=45a7b2b1"},
        {src:"./vid/corgi-20.mp4?v=6f76bb6e", poster:"./vid/corgi-20.jpg?v=c6d5e5b6"},
        {src:"./vid/corgi-21.mp4?v=cc88e54b", poster:"./vid/corgi-21.jpg?v=658e7d81"},
        {src:"./vid/corgi-22.mp4?v=4d3c60e5", poster:"./vid/corgi-22.jpg?v=9f084c6e"},
        {src:"./vid/corgi-23.mp4?v=a964ce11", poster:"./vid/corgi-23.jpg?v=1360273a"},
        {src:"./vid/corgi-24.mp4?v=142c8d3d", poster:"./vid/corgi-24.jpg?v=3642983a"},
        {src:"./vid/corgi-25.mp4?v=e8c6e244", poster:"./vid/corgi-25.jpg?v=ddbd3377"},
        {src:"./vid/corgi-26.mp4?v=af970b97", poster:"./vid/corgi-26.jpg?v=0c4bd963"},
        {src:"./vid/corgi-27.mp4?v=820b1bee", poster:"./vid/corgi-27.jpg?v=62d7f49f"},
        {src:"./vid/corgi-28.mp4?v=64f5df51", poster:"./vid/corgi-28.jpg?v=04eb1f82"},
        {src:"./vid/corgi-29.mp4?v=ab910b6e", poster:"./vid/corgi-29.jpg?v=45ed8580"},
        {src:"./vid/corgi-30.mp4?v=5dd20053", poster:"./vid/corgi-30.jpg?v=f9fdc61a"},
        {src:"./vid/corgi-31.mp4?v=4dc68f3a", poster:"./vid/corgi-31.jpg?v=5a1c378f"},
        {src:"./vid/corgi-32.mp4?v=c0a896e9", poster:"./vid/corgi-32.jpg?v=8fc590ef"},
        {src:"./vid/corgi-33.mp4?v=862ae75c", poster:"./vid/corgi-33.jpg?v=eefd7377"},
        {src:"./vid/corgi-34.mp4?v=2dd9f83f", poster:"./vid/corgi-34.jpg?v=e501ff5e"},
        {src:"./vid/corgi-35.mp4?v=4052b86b", poster:"./vid/corgi-35.jpg?v=3c156837"},
        {src:"./vid/corgi-36.mp4?v=a1e97a7a", poster:"./vid/corgi-36.jpg?v=abe9a3ce"},
        {src:"./vid/corgi-37.mp4?v=168b0fe2", poster:"./vid/corgi-37.jpg?v=f0ea9866"},
        {src:"./vid/corgi-38.mp4?v=d6e85908", poster:"./vid/corgi-38.jpg?v=45e38f93"},
        {src:"./vid/corgi-39.mp4?v=4cddaca4", poster:"./vid/corgi-39.jpg?v=bd5da294"},
        {src:"./vid/corgi-40.mp4?v=25c304b2", poster:"./vid/corgi-40.jpg?v=25a26459"},
        {src:"./vid/corgi-41.mp4?v=1b65fdbb", poster:"./vid/corgi-41.jpg?v=bde4d82c"}
    ];

    var bag=[];

    function shuffled(arr){
        var a=arr.slice(), i, j, t;
        for(i=a.length-1;i>0;i--){
            j=Math.floor(Math.random()*(i+1));
            t=a[i]; a[i]=a[j]; a[j]=t;
        }
        return a;
    }

    /* 取下一张壁纸：池子空了就重新洗一轮 */
    function next(){
        if(!pool.length){ return null; }
        if(!bag.length){ bag=shuffled(pool); }
        return bag.pop();
    }

    window.homeWallpaperPool=pool;
    window.nextHomeWallpaper=next;
})();
