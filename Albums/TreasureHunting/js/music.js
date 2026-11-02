/////////////////////<----------数据区-------->/////////////////////////
var data=[
            {
                song:"明智之举",
                singer:"许嵩",
                src:"mp3/许嵩 - 明智之举.m4a",
                img:'css/img/明智之举cover.webp',
                lyric:'明智之举'
            },
            {
                song:"如约而至",
                singer:"许嵩",
                src:"mp3/许嵩 - 如约而至.m4a",
                img:'css/img/如约而至cover.jpg',
                lyric:'如约而至'
            },
            {
                song:"大千世界",
                singer:"许嵩",
                src:"mp3/许嵩 - 大千世界.m4a",
                img:'css/img/大千世界cover.webp',
                lyric:'大千世界'
            },
            {
                song:"老古董",
                singer:"许嵩",
                src:"mp3/许嵩 - 老古董.m4a",
                img:'css/img/老古董cover.webp',
                lyric:'老古董'
            },
            {
                song:"艺术家们",
                singer:"许嵩",
                src:"mp3/许嵩 - 艺术家们.m4a",
                img:'css/img/艺术家们cover.jpg',
                lyric:'艺术家们'
            },
            {
                song:"柳成荫",
                singer:"许嵩",
                src:"mp3/许嵩 - 柳成荫.m4a",
                img:'css/img/柳成荫cover.jpg',
                lyric:'柳成荫'
            },
            {
                song:"重复重复",
                singer:"许嵩",
                src:"mp3/许嵩 - 重复重复.m4a",
                img:'css/img/重复重复cover.jpg',
                lyric:'重复重复'
            },
            {
                song:"九月清晨",
                singer:"许嵩",
                src:"mp3/许嵩 - 九月清晨.m4a",
                img:'css/img/九月清晨cover.jpg',
                lyric:'九月清晨'
            },
            {
                song:"浪",
                singer:"许嵩",
                src:"mp3/许嵩 - 浪.m4a",
                img:'css/img/浪cover.jpg',
                lyric:'浪'
            }
];
///////////////////<-------变量区-------->//////////////////////////////////////

    var Audio1=document.getElementsByTagName('audio')[0];
    var processBar=document.getElementById("process-bar");//进度条
    var curBtn=document.getElementById("cur-btn");//进度条拖拽按钮
    var processCur=document.getElementById("process-cur");//进度条播放线
    var totalTime=document.getElementById("total-time");//歌曲总时长
    var currentTime=document.getElementById("currentTime");//歌曲当前播放时间
    var playBtn=document.getElementsByClassName("play")[0];//播放键
    var pauseBtn=document.getElementsByClassName("pause")[0];//暂停键
    var preBtn=document.getElementsByClassName("pre")[0];//上一曲键
    var nextBtn=document.getElementsByClassName("next")[0];//下一曲键
    var styli=document.getElementById("styli");//唱针
    var bg=document.getElementsByClassName("bg")[0];//大背景
    /* ---------------- 随机视频背景（配置在站根 js/video-bg.js） ----------------
       概率 = 视频数 / 全站歌曲数（钳制 10%~50%）；一轮 = 10 次换歌，
       每轮必出 round(概率×10) 次，位置随机。加/删视频只改 video-bg.js。 */
    var videoPlan=new VideoBgPlan();
    var curVideo=null;
    var bgVideoBox=document.getElementById("bgVideoBox");//视频背景容器
    var bgVideoEl=document.getElementById("bgVideoEl");//背景视频
    /* 每次换歌推进一次轮内位置，返回这一步该不该出视频 */
    function stepVideo(index){
        var rand=videoPlan.next();                       /* 随机轮照常推进，概率节奏不受影响 */
        var item=data[index]||{};
        var fixed=window.videoBgBySong&&window.videoBgBySong[item.song];
        curVideo=fixed||rand;                            /* 专属背景优先，其余走随机 */
        return curVideo;
    }
    /* 旋转唱片的封面：这一步命中视频就用视频圆图，否则用专辑封面 */
    function songImg(index){
        var item=data[index]||{};
        return (curVideo&&curVideo.cover)?curVideo.cover:item.img;
    }
    /* 纯专辑封面：切歌动画里两张盘的预览图，最终封面由 show() 决定 */
    function albumCover(index){
        var item=data[index]||{};
        return item.img;
    }
    function applySongVideo(){
        if(!bgVideoBox||!bgVideoEl) return;
        var cfg=curVideo;
        if(!cfg){
            bgVideoBox.className="bg-video";
            bgVideoEl.pause();
            return;
        }
        if(bgVideoEl.getAttribute("data-src")!==cfg.src){
            bgVideoEl.setAttribute("data-src",cfg.src);
            if(cfg.poster){ bgVideoEl.setAttribute("poster",cfg.poster); }
            bgVideoEl.src=cfg.src;
            bgVideoEl.load();
        }
        bgVideoBox.className="bg-video on";
        bgVideoEl.muted=true;
        var p=bgVideoEl.play();
        if(p&&p.catch){ p.catch(function(){}); }
    }

    var disk = document.getElementsByClassName("disk");//唱片图(新增)
    var albumBg=document.getElementsByClassName("disk-album-bg");//专辑图片（去掉了[0]）
    var songName=document.getElementById("songName");//歌曲名

    // 24色淡雅随机色系：色相每15度一档共24色，饱和度50%、亮度80%，偏淡典雅，深色背景上可读
    var titleColors=['#E6B3B3', '#E6BFB3', '#E6CCB3', '#E6D9B3', '#E5E6B3', '#D9E6B3', '#CCE6B3', '#BFE6B3', '#B3E6B3', '#B3E6BF', '#B3E6CC', '#B3E6D9', '#B3E5E6', '#B3D9E6', '#B3CCE6', '#B3BFE6', '#B3B3E6', '#BFB3E6', '#CCB3E6', '#D9B3E6', '#E6B3E5', '#E6B3D9', '#E6B3CC', '#E6B3BF'];
    // 同一首歌只用一种颜色：切歌过程中标题会被多次赋值（先换数据、唱片到位后再渲染一次），
    // 这里按歌曲下标记住颜色，同一首歌重复赋值时复用同一颜色，换到另一首歌时才重新随机（且不与上一首重复）
    var lastTitleSongIndex=-1;
    var currentTitleColor='';
    function randomTitleColor(songIndex){
        if(songIndex===lastTitleSongIndex && currentTitleColor){
            songName.style.color=currentTitleColor;
            return;
        }
        var idx;
        do{ idx=Math.floor(Math.random()*titleColors.length); }while(titleColors[idx]===currentTitleColor);
        lastTitleSongIndex=songIndex;
        currentTitleColor=titleColors[idx];
        songName.style.color=currentTitleColor;
    }
    var artist=document.getElementById("artist");//歌手
    var playListCount=document.getElementById("playListCount");//播放列表歌曲数量
    var listBtn=document.getElementsByClassName("list")[0]; //列表按钮
    var playList=document.getElementById('play-list'); //歌曲列表
    var listClose=document.getElementsByClassName('list-title-close')[0]; //列表右上角关闭按钮
    var loop=document.getElementsByClassName('loop')[0];//循环按钮
    var ul=playList.getElementsByTagName('ul')[0];//播放列表ul
    var lis=playList.getElementsByTagName('li');//播放列表li
    var w = document.documentElement.clientWidth;//可视区宽度（新增）
    var jl = w+122;//被隐藏的轮播图的位置（新增）
    var timer2=null;//定时器
    var n = 0; //当前播放歌曲下标
    var durationT=0;//歌曲总时长
    var changing=false;//监控歌曲切换过程是否在进行中
    var ended=false;//监控歌曲是否结束
    var prevSong=-1;//上一曲下标
    var curDraging=false; //监控进度点是否是在拖拽中
    //--------------歌词相关变量---------------
    var oCenter=document.querySelector('.center');//中间部分（用于歌词界面显示点击）
    var oLyric=document.querySelector(".lyric");//歌词界面div
    var lyricUl=document.querySelector(".lyric ul");//歌词界面ul
    var lyricLi=lyricUl.getElementsByTagName("li");//歌词界面li
    var olyricLine=document.getElementById('line');//歌词定位黄色虚线
    var oBgBlack=document.querySelector('.bg-black');//歌词界面遮罩背景
    var oListMask=document.getElementById('list-mask');//播放列表的遮罩背景（用于隐藏播放列表点击）
    var lyric={
        lyricStr:'',//储存当前歌曲歌词字符串数据
        unitHeight:42,//每个歌词li的高度
        lyricTop:180,//ul初始高度
        lyNum:0,//当前显示第几句歌词
        lyMTime:[],//每句歌词运动时间
        lyMtext:[],//每句歌词
        timer:null,//歌词自动滚动的定时器
        lyPreNum:-1,//上一句歌词下标
        color:'#fff',//改变当前播放歌词颜色
        offset:0,//歌词偏移（可以提前或延迟歌词滚动，负数提前正数延迟）
        draging:false//歌词是否拖拽
    };

/////////////////<-----函数区------->////////////////////////////////////////////////

    // 1.上下曲切换时图片轮播函数
    window.onresize=function () {
        var preW=w;
        w = document.documentElement.clientWidth;
        if (disk[0].offsetLeft>0&&disk[0].offsetLeft<preW) {
            disk[0].style.left=w/2+"px";
        }
        if (disk[1].offsetLeft>0&&disk[1].offsetLeft<preW) {
            disk[1].style.left=w/2+"px";
        }
    };
    function round(i,j,x){
        // i:数据的下标 j:轮播图的下标0 X:轮播图下标1
        //下一首点击要改变的状态
        Audio1.src=data[i].src;
        timer1();
        if(x>j){
            disk[0].style.left=w/2+"px";
            disk[1].style.left=jl+"px";
            if (prevSong>-1) {
                albumBg[0].src=albumCover(prevSong);
            }
            albumBg[1].src=albumCover(n);
            move(disk[x],{left:w/2},600,'linear');
            move(disk[j],{left:-122},610,'linear',function(){
                albumBg[j].src=albumCover(i);
                disk[j].style.left = "";
                disk[x].style.left = jl +"px";
                show(i,j,x);
                playState();
                changing = false;
            });
        }
        //上一首点击要改变的状态
        if(x<j){
            disk[0].style.left="-122px";
            disk[1].style.left=w/2+"px";
            albumBg[0].src=albumCover(n);
            if (prevSong>-1) {
            albumBg[1].src=albumCover(prevSong);
            }
            move(disk[x],{left:w/2},600,'linear');
            move(disk[j],{left:jl},610,'linear',function(){
                console.log(Audio1.currentTime);
                albumBg[j].src=albumCover(i);
                disk[j].style.left = "";
                disk[x].style.left = -"122px";
                show(i,j,x);
                playState();
               changing = false;
            });
        }
    }
    //2.播放状态监控函数
    function playState(){
        if(playBtn.onOff){
            styli.className='';
            Audio1.play();
            animateRun ();
            lyricTimer ();
        }else{
            styli.className='play-needle';
        }
    }
    // 3.歌曲切换时页面渲染函数
    function show(i,j,x){
        stepVideo(i);/* 换歌：先查专属背景，未命中再按随机轮决定 */
        songName.innerHTML=data[i].song; randomTitleColor(i);
        artist.innerHTML=data[i].singer;
        disk[j].style.left = w/2 +"px";
        if(x>j){
            albumBg[j].src=songImg(i);
            disk[x].style.left = jl + "px";
        }
        if(x<j){
            albumBg[j].src=songImg(i);
            disk[x].style.left = "-122px";
        }
        bg.style.backgroundImage='url('+data[i].img+')';
        applySongVideo();/* 这一步命中视频就换成视频背景，否则回落到模糊封面 */
        Audio1.src=data[i].src;
        timer1();
        playListCount.innerHTML=data.length;
    }
    show(0,0,1);//播放页面初始化渲染
    albumBg[0].src=songImg(0);
    albumBg[1].src=songImg(0);
    // 4.将秒换算成分钟 换算后放入相应innerHTML函数
    function sToM (sec,name) {
    	var m=Math.floor(sec/60);
    	var s=Math.floor(sec%60);
    	name.innerHTML=toZero (m)+':'+toZero (s);
    }
    //5.时间补0函数
    function toZero(n){
    	return n<10?'0'+n:''+n;
    }
    //6.进度点位置(当前播放时间)根据鼠标位置移动（改变）函数
    function curMoveByMouse(mL,distance,fl){
    	//鼠标需要移动的宽度
    	var tar=mL-distance+fl;//
    	// 鼠标当前的位置-进度点距离页面左边的距离（或者进度条移动前的位置）+进度条的left=鼠标需要移动的宽度
		if(tar>235){
			tar=235;
		}
		if(0>tar){
			tar=0;
		}
		curBtn.style.left=tar+'px';
		processCur.style.width=tar+'px';
        lyMoveTo ((tar/235)*durationT);
		Audio1.currentTime=(tar/235)*durationT;//歌曲当前时间变为拖拽的位置对应的时间
        sToM (Audio1.currentTime ,currentTime);
    }
    //7.进度点根据播放当前时间运动函数
    function curMoveByCurtime(nowtime,alltime){
        if (nowtime>alltime) {
            nowtime=alltime;
        }
    	processCur.style.width=(nowtime/alltime)*235 +'px';
    	curBtn.style.left=(nowtime/alltime)*235 +'px';//进度点的位置根据歌曲的时间运动
    }
    // 8.通过定时器获取当前歌曲的总时长 （需要延迟获取）
    function timer1(){
    	var timer1=setInterval(function() {
    		if (Audio1.duration) {
    		// 获取到当前歌曲的总时长后就不用再获取了
                durationT=Audio1.duration;
    			clearInterval(timer1);
    			sToM (Audio1.duration,totalTime);
    		}
    	}, 16);
    }
    //9.一首歌曲走完时，循环方式载入函数
    function ifEnd () {
        if(ended){
            reStatus();
            if(loop.onOff){
                //列表循环
                //切换下一首
                if (!changing) {
                    nextsong();
                }
            }else {
                playState();
            }
        }
    }
    //10.通过定时器不断获取当前歌曲的当前播放时间
    function timer(){
        ifEnd ();
        clearInterval(timer2);
    	timer2=setInterval(function() {
        if(curDraging){
            return;
        }
        ended=Audio1.ended;
        sToM (Audio1.currentTime ,currentTime);
        ifEnd ();
    	curMoveByCurtime(Audio1.currentTime,durationT);
    }, 500);}
    //11.播放列表根据点击歌曲上下滚动函数
    function scrollToMove(obj,target,time) {
        var scrollTopMax=0;
        if (document.documentElement.clientHeight<obj.offsetHeight) {
            scrollTopMax=obj.scrollHeight-document.documentElement.clientHeight;
        }else {
            scrollTopMax=obj.scrollHeight-obj.offsetHeight;
        }
        if (target<0) {
            target=0;
        }
        if (target>scrollTopMax) {
            target=scrollTopMax;
        }
        var nowScrollTop=obj.scrollTop;
        var disTop=target-nowScrollTop;
        var ci=time/20;
        var perDis=disTop/ci;
        var num=0;
        clearInterval(obj.timer);
        if (obj.scrollTop==scrollTopMax&&perDis>=0) {
            return;
        }
        if (obj.scrollTop==0&&perDis<=0) {
            return;
        }
        obj.timer=setInterval(function() {
            num++;
            var goal=nowScrollTop+Math.round(perDis*num);
            if (goal<0) {
                goal=0;
            }else if(goal>scrollTopMax){
                goal=scrollTopMax;
            }
            obj.scrollTop=goal;
            if (num==ci) {
                obj.scrollTop=target;
                clearInterval(obj.timer);
            }
        },20);
    }
    //12.唱片转动函数
    function animateRun () {
        disk[0].style.animationPlayState="running";
        disk[0].style.WebkitAnimationPlayState="running";
        disk[1].style.animationPlayState="running";
        disk[1].style.WebkitAnimationPlayState="running";
    }
    //13.唱片静止函数
    function animatePau () {
        disk[0].style.animationPlayState="paused";
        disk[0].style.WebkitAnimationPlayState="paused";
        disk[1].style.animationPlayState="paused";
        disk[1].style.WebkitAnimationPlayState="paused";
    }
    //14.状态初始化
    function reStatus(){
       currentTime.innerHTML='00:00';
       Audio1.currentTime=0.001;
       curMoveByCurtime(Audio1.currentTime,durationT);
       Audio1.pause();
       animatePau ();
       clearInterval(lyric.timer);
    }
    // 15.歌曲切换时数据切换
    function tabData(){
        loadLyric (data[n].lyric);
        songName.innerHTML=data[n].song; randomTitleColor(n);
        artist.innerHTML=data[n].singer;
    }
    // 16.下一曲函数
    // 随机挑一首与当前不同的歌（只有一首时原地不动）
    function randomSong(){
        if (data.length < 2) {
            return n;
        }
        var r=n;
        while (r==n) {
            r=Math.floor(Math.random()*data.length);
        }
        return r;
    }
    function nextsong(){
        reStatus();
        changing = true;
        prevSong=n;
        if (loop.random) {
            //随机播放
            n=randomSong();
        }else{
            n++;
            if (n > data.length - 1) {
              n = 0;
            }
        }
        tabData();
        nextTab();
    }
    // 17.下一曲状态与运动
    function nextTab(){
        if(playBtn.onOff){
            styli.className='play-needle';
            setTimeout(function(){
                round(n,0,1);
            },500);
        }else{
            round(n,0,1);
        }
    }
    //--------歌词相关函数区--------//
    //18.载入歌词数据生成一堆li
    function loadLyric (name) {
        lyReset ();
        lyric.lyricStr=lyrics[name];
        lyric.lyMTime=returnTimeLyric(lyric.lyricStr)[0];
        lyric.lyMtext=returnTimeLyric(lyric.lyricStr)[1];
            lyricUl.innerHTML='';
            for (var i = 0; i < lyric.lyMtext.length; i++) {
                var li1=document.createElement('li');
                if (lyric.lyMtext[i]=='') {
                    li1.innerHTML='&nbsp;';
                }else {
                    li1.innerHTML=lyric.lyMtext[i];
                }
                lyricUl.appendChild(li1);
            }
    }
    //19.歌词清除样式,ul回到顶部(切换歌曲调用，歌词复位)
    function lyReset () {
        lyric.lyPreNum=-1;//上一句复位
        lyric.lyNum=0;//当前句复位
        lyricUl.style.top=lyric.lyricTop+'px';//ul初始高度
    }
    //20.歌词根据播放时间滚动
    function lyMoveTo (time) {
        var last=true;//是否是最后一句
        for (var i = 0; i < lyric.lyMTime.length; i++) {
            if(lyric.lyMTime[i]>(time-lyric.offset)){
                lyric.lyNum=i-1;
                last=false;
                break;//显示第i个
            }
        }
        if (last) {
            lyric.lyNum=lyric.lyMTime.length-1;
        }
        if (lyric.lyNum<0) {
            lyric.lyNum=0;
        }
        if (!lyricLi[lyric.lyNum]) {
            return;
        }
        if (lyric.lyPreNum==lyric.lyNum) {
            return;
        }else {
            if (lyric.lyPreNum>-1) {
                lyricLi[lyric.lyPreNum].className="";
                lyricLi[lyric.lyPreNum].style.cssText='';
            }
            lyric.lyPreNum=lyric.lyNum;
        }
        lyricLi[lyric.lyNum].className="active";
        lyricLi[lyric.lyNum].style.color=lyric.color;
        move(lyricUl,{top:lyric.lyricTop-lyric.unitHeight*lyric.lyNum},150,'easeIn');
    }
    //21.主要给歌词根据播放时间滚动加判断
    function lyricTimer () {
        clearInterval(lyric.timer);
        lyric.timer=setInterval(function () {
            if (lyric.draging) {
                return;
            }
            if(curDraging){
                return;
            }
            if (!playBtn.onOff) {
                clearInterval(lyric.timer);
                return;
            }
            if (!Audio1.currentTime) {
                return;
            }
            lyMoveTo(Audio1.currentTime);
        }, 150);
    }
    // 22.拆分歌词数据中的时间和歌词，并做匹配一一对应
    function returnTimeLyric (lyric) {
        var arr=lyric.split('[');
        var arrTime=[];
        var arrLyric=[];
        var arrTemp=[];
        for (var i = 1; i < arr.length; i++) {
            arrTime.push(minToSec(arr[i].split(']')[0]));
            arrLyric.push(arr[i].split(']')[1]);
        }
        arrTemp.push(arrTime,arrLyric);
        return arrTemp;
    }
    // 23.分钟转化成秒
    function minToSec (StrTime) {
        var arr=StrTime.split(':');
        var sec=parseFloat((parseFloat(arr[0])*60+parseFloat(arr[1])).toFixed(2));
        return sec;
    }

///////////////////////<--------事件区--------->//////////////////////////////////////////

    // 1.播放键点击事件
    playBtn.onclick=function(){
        ended=Audio1.ended;
        //this.onOff用来检测播放暂停键状态
        this.onOff = true;
    	// 切换播放键状态为暂停并开始播放
    	this.style.display='none';
    	pauseBtn.style.display='inline-block';
        if (!changing) {
            Audio1.play();
            animateRun ();
            lyricTimer ();
        }
    	// 播放后唱针进入唱片
    	styli.className='';
    	timer();
    	bg.style.webkitFilter='blur(10px)';//改变模糊度
    };
     // 2.暂停键点击事件
    pauseBtn.onclick=function(){
        playBtn.onOff = false;
        clearInterval(lyric.timer);
    	// 切换播放键状态为暂停
    	this.style.display='none';
    	playBtn.style.display='inline-block';
    	Audio1.pause();
        animatePau ();
    	// 暂停播放时唱针离开唱片
    	styli.className='play-needle';
    	clearInterval(timer2);
    	bg.style.webkitFilter='blur(18px)';
    };
    //3.鼠标拖拽进度条事件
    curBtn.onclick=function (ev) {
        ev=ev||window.event;
        ev.stopPropagation();//点击的时候阻止拖拽
    };
    // 鼠标向下时可以点住进度条按钮进行横向拖拽移动
    curBtn.onmousedown=function(ev){
        if (changing) {
            return;
        }
    	// 鼠标向下时，获取到当前left的位置（0-235）
    	var fl=curBtn.offsetLeft+10;//进度条的left(加本身的margin)
    	// 然后获取鼠标点击的X坐标
    	var bL=ev.clientX;
        curDraging=false;
        var tar=fl;
    	document.onmousemove=function(e){
            curDraging=true;
            //鼠标需要移动的宽度
            tar=e.clientX-bL+fl;//
            // 鼠标当前的位置-进度点距离页面左边的距离（或者进度条移动前的位置）+进度条的left=鼠标需要移动的宽度
            if(tar>235){
                tar=235;
            }
            if(0>tar){
                tar=0;
            }
            curBtn.style.left=tar+'px';
            processCur.style.width=tar+'px';
            lyMoveTo ((tar/235)*durationT);
            // 移动过程中不改变当前歌曲当前时间
            sToM ((tar/235)*durationT,currentTime);
    	};
        document.onmouseup=function(){
            curDraging=false;
            Audio1.currentTime=(tar/235)*durationT;//鼠标抬起后改变当前时间(回到移动时的位置的时间)
            document.onmousemove=null;
            document.onmouseup=null;
        };
    };
    // 4.点击进度条任意位置时，进度点和当前时间跳到对应的位置
    processBar.onclick=function(e){
        if (changing) {
            return;
        }
		var bL=curBtn.getBoundingClientRect().left;
		var mL=e.clientX;
		var fl=curBtn.offsetLeft;//进度条的left
		curMoveByMouse(mL,bL,fl);
    };
    // 5.上一曲点击事件
    preBtn.onclick=function(){
        if(!changing){
            reStatus();
            changing = true;
            prevSong=n;
            if (loop.random) {
                //随机播放：上一首同样随机
                n=randomSong();
            }else{
                n--;
                if(n < 0){
                    n = data.length-1;
                }
            }
            tabData();
            if(playBtn.onOff){
                styli.className='play-needle';
                setTimeout(function(){
                    round(n,1,0);
                },500);
            }else{
                round(n,1,0);
            }
        }
    };
    // 6.下一曲点击事件
    nextBtn.onclick=function(){
        if(!changing){
            nextsong();
        }
    };
    //7.播放列表按钮点击显示播放列表事件
    listBtn.onclick=function(){
        ul.scrollTop=42*(n-2);
        oListMask.style.display='block';
        move(playList,{bottom:0},200,'easeIn');
    };
    //8.点击页面隐藏播放列表事件
    oListMask.onclick=function () {
        oListMask.style.display='none';
        move(playList,{bottom:-playList.offsetHeight},200,'easeIn');
    };
    //9.列表右上角关闭按钮点击隐藏播放列表事件
    listClose.onclick=function(){
        oListMask.style.display='none';
        move(playList,{bottom:-playList.offsetHeight},200,'easeIn');
    };
    // 10.列表单个点击切换歌曲，并移动列表事件(播放列表根据数据循环生成)
    for (var i = 0; i < data.length; i++) {
        var li=document.createElement('li');
        var span=document.createElement('span');
        li.index=i;
        // 行本身不响应单击：只有悬停出现的状态图标可点
        li.onclick=function (ev) {
            var t=ev&&ev.target;
            if (t&&t.nodeName==='I') {
                if (this.index==n) {
                    togglePlay();
                }else {
                    playAt(this.index);
                }
            }
        };
        // 双击任意曲目：正在播放的那首切换播放/暂停，其它曲目切过去播放（双击图标交给单击处理）
        li.ondblclick=function (ev) {
            var t=ev&&ev.target;
            if (t&&t.nodeName==='I') {
                return;
            }
            if(changing){
                return;
            }
            if(this.index==n){
                togglePlay();
            }else {
                playAt(this.index);
            }
        };

        li.innerHTML='<i class="ic"><b></b><b></b><b></b></i>'+data[i].song;
        span.innerHTML="寻宝游戏";
        li.appendChild(span);
        ul.appendChild(li);
    }
    // 列表状态：只有正在播放的那一首带 playing 类（显示条形图），悬停样式交给 CSS
    function renderList(){
        var playing=!Audio1.paused&&!Audio1.ended;
        for (var j = 0; j < lis.length; j++) {
            var cls=(playing&&j==n)?'playing':'';
            if (lis[j].className!=cls) {
                lis[j].className=cls;
            }
        }
    }
    // 与中间播放/暂停按钮保持一致
    function togglePlay(){
        if(playBtn.onOff){
            pauseBtn.onclick();
        }else {
            playBtn.onclick();
        }
    }
    // 切到指定曲目并播放（暂停状态下也直接开始播放）
    function playAt(i){
        if(changing){
            return;
        }
        if(i==n){
            return;
        }
        prevSong=n;
        n=i;
        loadLyric(data[n].lyric);
        songName.innerHTML=data[n].song; randomTitleColor(n);
        artist.innerHTML=data[n].singer;
        reStatus();
        if(!playBtn.onOff){
            playBtn.onOff=true;
            playBtn.style.display='none';
            pauseBtn.style.display='inline-block';
            styli.className='';
            bg.style.webkitFilter='blur(10px)';
            timer();
        }
        changing=true;
        nextTab();
        scrollToMove(ul,42*(i-2),400);
        renderList();
    }
    Audio1.addEventListener('play',renderList);
    Audio1.addEventListener('playing',renderList);
    Audio1.addEventListener('pause',renderList);
    Audio1.addEventListener('ended',renderList);
    renderList();
    // 面板高度随曲目行数变化：初始位置按自身高度算，保证完全藏在视口外
    playList.style.bottom=-playList.offsetHeight+'px';
    //11.播放模式：一个按钮循环切换 列表循环 → 单曲循环 → 随机播放
    //    loop.onOff：true 时一首放完自动切下一首（列表循环 / 随机播放），false 时单曲循环重放
    //    loop.random：是否随机播放
    function setMode(mode){
        loop.mode=mode;
        loop.onOff=(mode!=='solo');
        loop.random=(mode==='random');
        loop.className='loop'+(mode==='solo'?' solo':(mode==='random'?' random':''));
        loop.setAttribute('aria-label',mode==='solo'?'单曲循环':(mode==='random'?'随机播放':'列表循环'));
    }
    setMode('list');
    loop.onclick=function(){
        setMode(loop.mode==='list'?'solo':(loop.mode==='solo'?'random':'list'));
    };
    //12.歌词初始化
    loadLyric (data[n].lyric);
    songName.innerHTML=data[n].song; randomTitleColor(n);
    artist.innerHTML=data[n].singer;
    //13.歌词面板隐藏点击事件
    oLyric.onOff=true;
    oLyric.onclick=function () {
        if (oLyric.onOff) {
            oLyric.style.display='none';
            oCenter.style.opacity='1';
            oBgBlack.style.display='none';
        }
    };
    //14.歌词面板显示点击事件
    oCenter.onclick=function () {
        oLyric.style.display='block';
        oCenter.style.opacity='0.001';
        oBgBlack.style.display='block';
    };
    //15.歌词面板拖拽事件
    oLyric.onmousedown=function (ev) {
        ev=ev||window.event;
        oLyric.onOff=true;
        var T1=ev.clientY;//鼠标当前y轴坐标
        var ulTop1=lyricUl.offsetTop;//歌词ul距离定位父级的top距离
        var finalTar=lyricUl.offsetTop;//歌词拖动结束时的目标点初始化
        document.onmousemove=function (ev) {
            if (changing) {
                return;
            }
            ev=ev||window.event;
            if (Math.abs(ev.clientY-T1)<4) {
                return;
            }
            lyric.draging=true;
            oLyric.onOff=false;
            olyricLine.style.display="block";
            var target=ev.clientY-T1+ulTop1;
            if (target>lyric.lyricTop) {
                target=lyric.lyricTop;
            }
            if (target<(-lyricUl.offsetHeight+lyric.lyricTop+lyric.unitHeight)) {
                target=(-lyricUl.offsetHeight+lyric.lyricTop+lyric.unitHeight);
            }
            lyricUl.style.top=target+"px";
            var numTar=Math.round((target-lyric.lyricTop)/lyric.unitHeight);
            finalTar=numTar*lyric.unitHeight+lyric.lyricTop;
            if (lyric.lyPreNum>-1) {
                lyricLi[lyric.lyPreNum].className="";
                lyricLi[lyric.lyPreNum].style.cssText='';
            }
            lyric.lyNum=Math.abs(numTar);
            lyricLi[lyric.lyNum].className="active";
            lyricLi[lyric.lyNum].style.color=lyric.color;
            lyric.lyPreNum=lyric.lyNum;
        };
        document.onmouseup=function () {
            if (changing) {
                return;
            }
            if (lyric.draging) {
                lyric.draging=false;
                olyricLine.style.display="none";
                if (lyric.lyMTime[lyric.lyNum]) {
                    Audio1.currentTime=(lyric.lyMTime[lyric.lyNum]+0.001);
                }else {
                    Audio1.currentTime=(lyric.lyMTime[0]+0.001);
                }
                sToM (lyric.lyMTime[lyric.lyNum] ,currentTime);
                curMoveByCurtime(lyric.lyMTime[lyric.lyNum],durationT);
                move(lyricUl,{top:finalTar},100,'easeIn');
            }
            document.onmousemove=null;
            document.onmouseup=null;
        };
    };

/////////////////////////////////！！！！！首页！！！！//////////////////////////////////////////////////////////
    // 主页代码 单独一个作用域自运行
    (function(){
        var stage=document.getElementById('stage');//主舞台
        var container=document.getElementsByClassName('container')[0];//中间大盒子
        var divs=container.getElementsByTagName('div');//唱片盒子
        var imgs=container.getElementsByTagName('img');  //唱片封面
        var tofirstpage=document.getElementById('tofirstpage');//回到首页按钮
        var time1=null;//盒子自动旋转定时器
        var onoff=true;
        var rotateing=true;//监控大盒子旋转变量
        var num=0;//唱片下标
        // 盒子自动旋转函数
        container.style.transform='rotateY(360deg)';
        timerBBBBB();
        function timerBBBBB(){
        clearInterval(time1);
          time1=setInterval(function() {
            if(onoff){
              container.style.transform='rotateY(0deg)';
            }else{
              container.style.transform='rotateY(360deg)';
            }
            onoff=!onoff;
          },3000);
        }
        // 1.大盒子鼠标移入展开事件
        container.onmouseover=function(){
            for (var i = 0; i < divs.length; i++) {
              divs[i].className='part'+(i+1);
            }
            if(rotateing){
                    switch (num)
                    {
                    case 0:
                      container.style.transform='rotateY(190deg)';
                      break;
                    case 1:
                      container.style.transform='rotateY(130deg)';
                      break;
                    case 2:
                     container.style.transform='rotateY(70deg)';
                      break;
                    case 3:
                     container.style.transform='rotateY(10deg)';
                      break;
                    case 4:
                      container.style.transform='rotateY(310deg)';
                      break;
                    case 5:
                      container.style.transform='rotateY(250deg)';
                      break;
                    }
            }
            clearInterval(time1);
        };
        // 2.大盒子鼠标移出聚拢事件
        container.onmouseout=function(){
            for (var i = 0; i < divs.length; i++) {
              divs[i].className='meet'+(i+1);
            }
            timerBBBBB();
            rotateing=true;
        };
        // 3.唱片盒子事件区
        for (var i = 0; i < divs.length; i++) {
            // 4.唱片盒子移入唱片显示事件
            divs[i].onmouseover=function(){
                this.style.backgroundSize='200px 200px';
                this.style.opacity=1;
                clearInterval(this.time);
                this.style.backgroundPosition="0px center";
            };
            // 4.唱片盒子移出唱片隐藏事件
            divs[i].onmouseout=function(){
                this.style.backgroundSize='0px 0px';
                this.style.opacity=0.8;
            };
            divs[i].index=i;
            // 5.唱片盒子双击进入播放页面并播放事件
            divs[i].ondblclick=function(){
                clearTimeout(this.timer);
                if (num!=this.index) {
                    return;
                }
                var _this=this;
                move(_this,{backgroundPosition:-100},1000,'linear');
                setTimeout(function(){
                    move(stage,{opacity:0},400,'linear');
                    prevSong=n;
                    n=num;
                    loadLyric (data[n].lyric);
                    playBtn.onOff = true;
                    playBtn.style.display='none';
                    pauseBtn.style.display='inline-block';
                    animateRun ();
                    lyricTimer ();
                    timer();
                    bg.style.webkitFilter='blur(10px)';//改变模糊度
                    styli.className='play-needle';
                    setTimeout(function(){
                        round(n,0,1);
                    },500);
                },200);
                setTimeout(function(){
                    stage.style.display='none';
                },1000);
            };
            // 6.唱片盒子单击事件大盒子旋转使其位居中间事件
            divs[i].onclick=function(){
                clearTimeout(this.timer);
                var _this=this;
                this.timer=setTimeout(function () {
                    rotateing=false;
                    num=_this.index;
                    switch (_this.className)
                    {
                    case 'part1':
                      container.style.transform='rotateY(190deg)';
                      break;
                    case 'part2':
                      container.style.transform='rotateY(130deg)';
                      break;
                    case 'part3':
                     container.style.transform='rotateY(70deg)';
                      break;
                    case 'part4':
                     container.style.transform='rotateY(10deg)';
                      break;
                    case 'part5':
                      container.style.transform='rotateY(310deg)';
                      break;
                    case 'part6':
                      container.style.transform='rotateY(250deg)';
                      break;
                    }
                },200);
            };
        }
        // 7.回到首页点击事件
        tofirstpage.onclick=function(){
            rotateing=true;
            stage.style.display='block';
            playBtn.onOff = false;
            pauseBtn.style.display='none';
            playBtn.style.display='inline-block';
            reStatus();
            // 暂停播放时唱针离开唱片
            styli.className='play-needle';
            clearInterval(timer2);
            bg.style.webkitFilter='blur(18px)';
            move(stage,{opacity:1},500,'linear');
        };
    })();
//////////////////////////<----- 歌曲直达：?song=曲名 打开即定位到该曲并直接播放（无切歌动效） ----->//////////////////////////
(function(){
    var m=/[?&]song=([^&#]*)/.exec(window.location.search);
    if(!m){ return; }
    var want='';
    try{ want=decodeURIComponent(m[1].replace(/\+/g,' ')); }catch(e){ want=m[1]; }
    var k=-1;
    for(var i=0;i<data.length;i++){ if(data[i].song===want){ k=i; break; } }
    var dlReady=false;
    function markReady(){
        if(dlReady){ return; }
        dlReady=true;
        var rootEl=document.documentElement;
        function applyReady(){
            rootEl.className+=' dl-ready';
            /* 过渡结束后撤掉标记：不长期保留 filter，也不改变 #play-list 的定位基准 */
            setTimeout(function(){ rootEl.className=rootEl.className.replace(/\s*dl-enter/,''); },750);
        }
        if(window.requestAnimationFrame){ requestAnimationFrame(function(){ requestAnimationFrame(applyReady); }); }
        else{ applyReady(); }
    }
    function unmarkEnter(){ document.documentElement.className=document.documentElement.className.replace(/\s*dl-enter/,''); }
    if(k<0){ unmarkEnter(); return; }
    // 跳过前面的 3D 唱片墙首页
    var stageEl=document.getElementById('stage');
    if(stageEl){ stageEl.style.display='none'; }

    // 记住浏览器拒绝播放的原因（NotAllowedError = 自动播放被拦截）
    var playErr='';
    var rawPlay=Audio1.play;
    Audio1.play=function(){
        var p;
        try{ p=rawPlay.apply(Audio1,arguments); }catch(e){ playErr=(e&&e.name)||'Error'; return; }
        if(p&&p.then){ p.then(null,function(e){ playErr=(e&&e.name)||'Error'; }); }
        return p;
    };

    if(k!==n){
        // 静态渲染到目标曲目：唱片直接摆在居中位，封面/背景/音源一次到位
        prevSong=n;
        n=k;
        loadLyric(data[n].lyric);
        show(n,0,1);
        albumBg[0].src=songImg(n);
        albumBg[1].src=songImg(n);
        disk[0].style.left=w/2+'px';
        disk[1].style.left=jl+'px';
        // 进度归零（不用 reStatus，避免旧曲时长参与换算）
        currentTime.innerHTML='00:00';
        Audio1.currentTime=0;
        processCur.style.width='0px';
        curBtn.style.left='0px';
        scrollToMove(ul,42*(k-2),400);
    }
    changing=false;
    // 直接进入播放状态
    playBtn.onOff=true;
    playBtn.style.display='none';
    pauseBtn.style.display='inline-block';
    styli.className='';
    bg.style.webkitFilter='blur(10px)';
    timer();
    Audio1.play();
    animateRun();
    lyricTimer();

    // ---- 入场过渡：封面就绪后去模糊、撤遮罩（最多等 600ms）----
    var coverImg=new Image();
    coverImg.onload=coverImg.onerror=function(){ setTimeout(markReady,50); };
    coverImg.src=data[n].img;
    setTimeout(markReady,600);

    // ---- 兜底：新标签页没有用户手势，浏览器可能直接拒绝带声播放 ----
    var hasPlayed=false;
    Audio1.addEventListener('playing',function(){ hasPlayed=true; });
    function revertToPause(){
        playBtn.onOff=false;
        playBtn.style.display='inline-block';
        pauseBtn.style.display='none';
        styli.className='play-needle';
        animatePau();
        clearInterval(lyric.timer);
        clearInterval(timer2);
        changing=false;
    }
    // 第一次交互时立刻开始播放
    function resume(){
        document.removeEventListener('pointerdown',resume,true);
        document.removeEventListener('keydown',resume,true);
        document.removeEventListener('touchstart',resume,true);
        var hint=document.getElementById('autoPlayHint');
        if(hint&&hint.parentNode){ hint.parentNode.removeChild(hint); }
        playBtn.onOff=true;
        playBtn.style.display='none';
        pauseBtn.style.display='inline-block';
        styli.className='';
        bg.style.webkitFilter='blur(10px)';
        timer();
        Audio1.play();
        animateRun();
        lyricTimer();
    }
    function armResume(){
        var hint=document.createElement('div');
        hint.id='autoPlayHint';
        if(window.console&&console.warn){ console.warn('[autoplay] 自动播放被拦截：'+(playErr||'unknown')); }
        hint.textContent='浏览器未允许自动播放 · 点击任意处开始播放';
        hint.style.cssText='position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:10000;padding:9px 20px;border-radius:22px;background:rgba(0,0,0,.6);color:#fff;font-size:14px;letter-spacing:1px;pointer-events:none;white-space:nowrap;';
        document.body.appendChild(hint);
        document.addEventListener('pointerdown',resume,true);
        document.addEventListener('keydown',resume,true);
        document.addEventListener('touchstart',resume,true);
    }
    setTimeout(function(){
        if(hasPlayed||!Audio1.paused){ return; }
        revertToPause();
        armResume();
    },1200);
})();
