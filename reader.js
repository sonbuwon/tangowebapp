/* 리더 콘텐츠 — OSTEP 서문(사용자 제공 한국어 번역)
   ────────────────────────────────────────────────────────────────
   sections 배열만 교체하면 리더 화면 내용이 바뀝니다.
   { h: "소제목", p: ["문단(HTML 가능)", ...] } 형태.
*/
const READER = {
  title: "서문 (Preface) — Operating Systems: Three Easy Pieces",
  source: "Remzi H. & Andrea C. Arpaci-Dusseau · 한국어 번역",
  sections: [
    {
      h: "모든 분께 (To Everyone)",
      p: [
        `이 책에 오신 것을 환영합니다! 우리가 이 책을 쓰면서 즐거웠던 만큼, 여러분도 읽으면서 즐거우셨으면 합니다. 이 책의 제목은 《Operating Systems: Three Easy Pieces》(운영체제: 세 가지 쉬운 조각, http://ostep.org 에서 볼 수 있습니다)이며, 이 제목은 물리학자 리처드 파인만(Richard Feynman)이 물리학을 주제로 만든, 역사상 가장 위대한 강의 노트 중 하나에 대한 오마주입니다 [F96]. 이 책이 그 유명한 물리학자가 세운 높은 기준에는 분명 미치지 못하겠지만, 운영체제(그리고 더 넓게는 시스템 전반)가 무엇인지 이해하려는 여러분의 여정에는 충분히 도움이 되기를 바랍니다.`,
        `'세 가지 쉬운 조각'은 이 책이 구성된 세 가지 주요 주제 요소를 가리킵니다. 바로 <b>가상화(virtualization)</b>, <b>동시성(concurrency)</b>, 그리고 <b>영속성(persistence)</b>입니다. 이 개념들을 다루다 보면 운영체제가 하는 중요한 일들 대부분을 함께 이야기하게 될 것이고, 그 과정에서 여러분도 약간의 재미를 느끼시길 바랍니다. 새로운 것을 배우는 건 재미있는 일이잖아요, 그렇죠? 적어도 (대체로는) 그래야 합니다.`,
        `각각의 주요 개념은 여러 장(chapter)으로 나뉘는데, 대부분의 장은 특정 문제를 제시한 뒤 그것을 어떻게 해결하는지를 보여줍니다. 각 장은 짧으며, 그 아이디어가 실제로 어디에서 비롯되었는지 원전(source material)을 (가능한 한) 참조하려고 노력합니다. 이 책을 쓰는 우리의 목표 중 하나는 역사의 흐름을 최대한 분명하게 보여주는 것입니다. 그것이 학생이 무엇이 지금이고, 무엇이 과거였으며, 무엇이 미래일지를 더 명확하게 이해하는 데 도움이 된다고 보기 때문입니다. 이런 점에서, 소시지가 어떻게 만들어졌는지를 보는 것은 그 소시지가 무엇에 쓸모 있는지를 이해하는 것만큼이나 중요합니다.`,
        `<span class="reader-fn">[1] 힌트: 먹는 것! 혹은 여러분이 채식주의자라면, 그 소시지로부터 도망치는 것.</span>`
      ]
    },
    {
      h: "책 속의 장치들",
      p: [
        `이 책 전반에 걸쳐 우리가 사용하는 몇 가지 장치가 있는데, 여기서 미리 소개해 두는 것이 좋겠습니다. 첫 번째는 <b>'문제의 핵심(the crux of the problem)'</b>입니다. 어떤 문제를 풀려고 할 때마다, 우리는 먼저 가장 중요한 쟁점이 무엇인지를 명시하려고 합니다. 이러한 '문제의 핵심'은 본문에서 명시적으로 강조되며, 나머지 본문에서 제시되는 기법, 알고리즘, 아이디어를 통해 해결되기를 바랍니다.`,
        `여러 곳에서 우리는 시스템의 동작을 시간 흐름에 따라 보여줌으로써 그 작동 방식을 설명할 것입니다. 이러한 <b>타임라인</b>은 이해의 핵심에 자리합니다. 예를 들어 프로세스가 페이지 폴트(page fault)를 일으킬 때 무슨 일이 벌어지는지 안다면, 여러분은 가상 메모리가 어떻게 동작하는지를 진정으로 이해하는 길에 들어선 것입니다. 또 저널링 파일 시스템(journaling file system)이 디스크에 블록을 쓸 때 무슨 일이 일어나는지를 이해한다면, 여러분은 저장 시스템(storage system)의 숙련을 향한 첫걸음을 뗀 것입니다.`,
        `또한 본문 곳곳에는 수많은 <b>'곁가지 설명(aside)'</b>과 <b>'팁(tip)'</b>이 들어 있어 본문의 주된 흐름에 약간의 색채를 더합니다. 곁가지 설명은 본문과 관련은 있지만 (반드시 필수적이지는 않은) 내용을 다루는 경향이 있고, 팁은 여러분이 직접 만드는 시스템에 적용할 수 있는 일반적인 교훈인 경우가 많습니다. 책 끝의 색인(index)에는 이러한 팁과 곁가지 설명들(그리고 'crux'의 흔치 않은 복수형인 'cruces')이 모두 정리되어 있어 편리하게 찾아볼 수 있습니다.`,
        `우리는 책 전반에 걸쳐 가장 오래된 교수법 중 하나인 <b>'대화(dialogue)'</b>를 사용합니다. 자료의 일부를 다른 각도에서 제시하기 위한 방법으로 말이죠. 이 대화들은 주요 주제 개념을 (앞으로 보게 되겠지만, 'peachy'한 방식으로) 소개하는 데 쓰이기도 하고, 때때로 내용을 복습하는 데에도 쓰입니다. 또한 좀 더 유머러스한 문체로 글을 쓸 기회이기도 합니다. 여러분이 이 대화들을 유용하다고 느낄지, 혹은 재미있다고 느낄지는 또 다른 문제이지만요.`,
        `각 주요 절(section)의 시작 부분에서 우리는 먼저 운영체제가 제공하는 어떤 <b>추상화(abstraction)</b>를 제시한 다음, 이어지는 장들에서 그 추상화를 제공하는 데 필요한 메커니즘(mechanism), 정책(policy), 그 밖의 지원 요소들을 다룰 것입니다. 추상화는 컴퓨터 과학의 모든 측면에서 근본적인 것이므로, 운영체제에서도 필수적이라는 사실은 어쩌면 놀랄 일이 아닙니다.`
      ]
    },
    {
      h: "실제 코드 · 숙제 · 프로젝트",
      p: [
        `각 장 전반에 걸쳐 우리는 가능한 한 (의사코드가 아닌) <b>실제 코드</b>를 사용하려고 합니다. 따라서 거의 모든 예제는 여러분이 직접 타이핑해서 실행해 볼 수 있을 것입니다. 실제 시스템에서 실제 코드를 실행해 보는 것이 운영체제를 배우는 가장 좋은 방법이므로, 가능할 때 꼭 그렇게 해 보시길 권합니다. 또한 우리는 여러분이 마음껏 살펴볼 수 있도록 코드를 공개하고 있습니다.`,
        `<span class="reader-fn">[2] https://github.com/remzi-arpacidusseau/ostep-code</span>`,
        `본문의 여러 부분에는 여러분이 지금 무슨 일이 벌어지고 있는지 제대로 이해하고 있는지 확인할 수 있도록 몇 가지 <b>숙제(homework)</b>를 곳곳에 넣어 두었습니다. 이 숙제들 중 상당수는 운영체제의 일부분을 흉내 낸 작은 시뮬레이션입니다. 여러분은 이 숙제들을 내려받아 실행하면서 스스로를 점검해 보아야 합니다. 이 숙제 시뮬레이터에는 다음과 같은 기능이 있습니다. 서로 다른 난수 시드(random seed)를 주면 사실상 무한한 문제 집합을 만들어 낼 수 있고, 시뮬레이터에게 문제를 대신 풀어달라고 시킬 수도 있습니다. 따라서 여러분은 충분한 수준의 이해에 도달할 때까지 스스로를 시험하고 또 시험할 수 있습니다.`,
        `이 책에 덧붙은 가장 중요한 부록은 일련의 <b>프로젝트(project)</b>입니다. 이 프로젝트에서 여러분은 자신만의 코드를 설계하고, 구현하고, 테스트함으로써 실제 시스템이 어떻게 동작하는지 배우게 됩니다. 모든 프로젝트는 (위에서 언급한 코드 예제와 마찬가지로) <b>C 프로그래밍 언어</b>로 되어 있습니다 [KR88]. C는 단순하면서도 강력한 언어로 대부분의 운영체제의 기반이 되며, 따라서 여러분의 언어 도구함에 더해 둘 가치가 있습니다. 두 가지 유형의 프로젝트가 제공됩니다(아이디어는 온라인 부록을 참고하세요). 첫 번째 유형은 <b>시스템 프로그래밍 프로젝트</b>입니다. 이 프로젝트들은 C와 UNIX가 처음이고 저수준(low-level) C 프로그래밍을 배우고 싶은 사람에게 아주 좋습니다. 두 번째 유형은 MIT에서 개발된 <b>xv6</b>라는 실제 운영체제 커널을 기반으로 합니다 [CK+08]. 이 프로젝트들은 이미 C를 어느 정도 다룰 줄 알고 OS 내부에 직접 손을 대보고 싶은 학생에게 아주 좋습니다. 위스콘신(Wisconsin)에서는 이 강의를 세 가지 방식으로 운영해 왔습니다. 전부 시스템 프로그래밍으로 하거나, 전부 xv6 프로그래밍으로 하거나, 둘을 섞는 방식입니다.`,
        `우리는 프로젝트 설명과 테스트 프레임워크를 차츰차츰 공개하고 있습니다. 더 많은 정보는 우리 저장소(repository)를 참고하세요. 만약 여러분이 어떤 수업의 일부로 이를 접하는 것이 아니라면, 이 프로젝트들을 스스로 해보면서 자료를 더 잘 익힐 기회가 될 것입니다. 안타깝게도 막혔을 때 괴롭힐(?) 조교(TA)가 없긴 하지만, 세상 모든 것이 공짜일 수는 없으니까요(그래도 책은 공짜일 수 있습니다!).`,
        `<span class="reader-fn">[3] https://github.com/remzi-arpacidusseau/ostep-projects</span>`
      ]
    },
    {
      h: "교육자분께 (To Educators)",
      p: [
        `이 책을 사용하고자 하는 강사나 교수님이라면, 부디 마음껏 사용하셔도 좋습니다. 이미 눈치채셨겠지만, 이 책은 무료이며 다음 웹페이지에서 온라인으로 받아보실 수 있습니다. http://www.ostep.org`,
        `또한 http://lulu.com 이나 http://amazon.com 에서 인쇄본을 구입하실 수도 있습니다. 위 웹페이지에서 찾아보세요. 이 책의 (현재 기준) 올바른 인용 정보는 다음과 같습니다.`,
        `<span class="reader-fn">Operating Systems: Three Easy Pieces<br>Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau<br>Arpaci-Dusseau Books<br>August, 2018 (Version 1.00) / July, 2019 (Version 1.01) / October, 2023 (Version 1.10)<br>http://www.ostep.org</span>`,
        `이 강의는 15주 학기에 꽤 잘 맞아떨어지며, 그 안에서 대부분의 주제를 적절한 깊이로 다룰 수 있습니다. 강의를 10주짜리 쿼터(quarter)에 욱여넣으려면 아마 각 조각에서 일부 세부 내용을 덜어내야 할 것입니다. 또한 가상 머신 모니터(virtual machine monitor)에 관한 몇 개의 장이 있는데, 보통 학기 중 어딘가에 끼워 넣습니다. 가상화에 관한 큰 절의 바로 끝부분이거나, 학기 막바지에 곁가지처럼 다루곤 합니다.`
      ]
    },
    {
      h: "강의 운영과 특징",
      p: [
        `이 책의 다소 특이한 점 하나는, 많은 OS 교재에서 앞부분에 배치하는 주제인 '동시성(concurrency)'을, 학생이 CPU와 메모리의 가상화에 대한 이해를 충분히 쌓을 때까지 뒤로 미뤄두었다는 것입니다. 거의 20년간 이 강의를 가르쳐 온 우리의 경험상, 학생들은 주소 공간(address space)이 무엇인지, 프로세스(process)가 무엇인지, 혹은 문맥 전환(context switch)이 왜 임의의 시점에 일어날 수 있는지를 아직 이해하지 못한 상태에서는 동시성 문제가 어떻게 발생하는지, 혹은 자신이 무엇을 해결하려는 것인지 이해하기 어려워합니다. 그러나 일단 이 개념들을 이해하고 나면, 스레드(thread)의 개념과 그로 인해 발생하는 문제들을 도입하는 일은 오히려 꽤 쉬워집니다. 적어도 더 쉬워지긴 합니다.`,
        `가능한 한 우리는 강의를 전달할 때 칠판(또는 화이트보드)을 사용합니다. 이렇게 좀 더 개념적인 날에는 몇 가지 주요 아이디어와 예제를 머릿속에 담아 수업에 들어가 칠판을 이용해 그것들을 제시합니다. 유인물(handout)은 학생들에게 그 내용을 바탕으로 풀어볼 구체적인 문제를 주는 데 유용합니다. 좀 더 실습 중심인 날에는 그냥 노트북을 프로젝터에 연결해 실제 코드를 보여줍니다. 이런 방식은 특히 동시성 강의에 잘 맞고, 학생들의 프로젝트와 관련된 코드를 보여주는 토론 세션에도 잘 맞습니다. 우리는 보통 자료를 제시할 때 슬라이드를 사용하지는 않지만, 그런 방식을 선호하는 분들을 위해 이제 슬라이드 한 세트도 마련해 두었습니다.`,
        `이 자료들 중 어떤 것이든 사본을 원하시면, 이메일을 보내주세요. 우리는 이미 전 세계의 많은 분들과 이 자료들을 공유해 왔고, 다른 분들 역시 자신의 자료를 기여해 주셨습니다.`,
        `마지막으로 한 가지 부탁이 있습니다. 무료 온라인 장(chapter)을 사용하실 때는 로컬에 사본을 만들기보다 그 페이지로 링크를 걸어 주세요. 이렇게 하면 우리가 사용량(매달 수백만 개의 장이 내려받아집니다)을 추적하는 데 도움이 되고, 학생들이 항상 최신(이자 가장 멋진?) 버전을 받아볼 수 있습니다.`
      ]
    },
    {
      h: "학생분께 (To Students)",
      p: [
        `이 책을 읽고 있는 학생이라면, 고맙습니다! 운영체제에 관한 지식을 추구하는 여러분의 여정에 도움이 될 자료를 제공할 수 있다는 것은 우리에게 영광입니다. 우리는 둘 다 학부 시절의 어떤 교재들(예: 컴퓨터 구조 분야의 고전인 헤네시와 패터슨(Hennessy and Patterson)의 책 [HP90])을 따뜻하게 회상하는데, 이 책도 여러분에게 그런 긍정적인 기억 중 하나가 되기를 바랍니다.`,
        `이 책이 무료이며 온라인으로 제공된다는 것을 눈치채셨을 겁니다. 여기에는 한 가지 큰 이유가 있습니다. 교재는 대체로 너무 비쌉니다. 우리는 이 책이, 세상 어느 지역에서 왔든 혹은 책에 얼마를 지불할 의향이 있든 상관없이 교육을 추구하는 이들을 돕기 위한 무료 자료의 새로운 물결의 첫 번째가 되기를 바랍니다. 그게 안 된다 하더라도, 이것은 한 권의 무료 책이며, 없는 것보다는 낫습니다.`,
        `<span class="reader-fn">[4] 여기서 '무료(free)'는 오픈 소스를 뜻하지 않으며, 저작권의 통상적 보호가 적용되지 않는다는 뜻도 아닙니다. 저작권은 분명히 적용됩니다! '무료'란 운영체제를 배우기 위해 각 장을 내려받아 사용할 수 있다는 뜻입니다. 왜 (리눅스 커널처럼) 오픈 소스 책으로 만들지 않았느냐면, 책에는 처음부터 끝까지 하나의 목소리가 있어야 한다고 믿기 때문입니다. 책이 마치 무언가를 설명해 주는 사람과의 대화처럼 느껴지길 바랍니다.</span>`,
        `또한 우리는 가능한 곳에서는, 이 책에 담긴 많은 자료의 원전(original source), 즉 수년에 걸쳐 운영체제 분야를 빚어낸 위대한 논문들과 인물들을 여러분에게 안내하고자 합니다. 아이디어는 허공에서 뚝 떨어지는 것이 아닙니다. 그것은 (수많은 튜링상 수상자를 포함한) 똑똑하고 부지런한 사람들로부터 나옵니다. 따라서 우리는 가능한 한 그 아이디어와 사람들을 기려야 합니다. 그렇게 함으로써, 마치 그러한 생각들이 늘 존재해 왔던 것처럼 글을 쓰는 대신 [K62], 그동안 일어난 혁명들을 더 잘 이해할 수 있기를 바랍니다. 더 나아가, 어쩌면 이러한 참고문헌들이 여러분이 스스로 더 깊이 파고들도록 자극할 수도 있습니다. 우리 분야의 유명한 논문들을 읽는 것은 분명 배움의 가장 좋은 방법 중 하나입니다.`,
        `<span class="reader-fn">[5] 튜링상(Turing Award)은 컴퓨터 과학에서 가장 높은 상으로, 노벨상과 같습니다. 다만 여러분이 들어본 적이 없을 뿐이죠.</span>`
      ]
    },
    {
      h: "감사의 글 (Acknowledgments)",
      p: [
        `이 절에는 이 책을 함께 만드는 데 도움을 준 분들에 대한 감사가 담길 것입니다. 지금으로서 중요한 것은 이것입니다. 바로 이 자리에 여러분의 이름이 들어갈 수도 있다는 것! 다만 여러분이 도와주셔야 합니다. 그러니 우리에게 피드백을 보내고 이 책의 오류를 함께 잡아주세요. 그러면 여러분도 유명해질 수 있습니다! 적어도 어떤 책에 이름은 남길 수 있습니다.`,
        `지금까지 도움을 주신 분들은 다음과 같습니다. (인명 목록은 고유명사이므로 원문 그대로 둡니다.)`,
        `<span class="reader-fn">Aaron Gember (Colgate), Aashrith H Govindraj (USF), Abdallah Ahmed, Abhinav Mehra, Abhinay Reddy, Abhirami Senthilkumaran*, Abhishek Bhattacherjee (NITR), Adam Drescher* (WUSTL), Adam Eggum, Adam Morrison, Aditya Venkataraman, Adriana Iamnitchi and class (USF), Ahmad Jarara, Ahmed Fikri*, Ajaykrishna Raghavan, Akiel Khan, Alain Clark (github), Alex Curtis, Alex Giorev, Alex Wyler, Alex Zhao (U. Colorado at Colorado Springs), Alexander Nordin (MIT), Ali Razeen (Duke), Alistair Martin, AmirBehzad Eslami, Anand Mundada, Andrei Bozantan, Andrew Mahler, Andrew Moss, Andrew Valencik (Saint Mary's), Angela Demke Brown (Toronto), Antonella Bernobich (UoPeople)*, Arek Bulski, Arun Rajan (Stonybrook), Aryan Arora, Axel Solis Trompler (KIT), B. Brahmananda Reddy (Minnesota), Bala Subrahmanyam Kambala, Bart Miller (Wisconsin), Basti Ortiz (github), Ben Kushigian (U. Mass), Benita Bose, Benjamin Wilhelm (Konstanz), Bill Yang, Biswajit Mazumder (Clemson), Bo Liu (UCSD), Bobby Jack, Bjorn Lindberg, Brandon Harshe (U. Minn), Brennan Payne, Brian Gorman, Brian Kroth, Calder White (University of Waterloo), Caleb Sumner (Southern Adventist), Cara Lauritzen, Charlotte Kissinger, Chen Huo (Shippensburg University), Chris Simionovici (U. Toronto), Cheng Su, Chien Chi, Chien-Chung Shen (Delaware)*, chriskorosu (github), Christian Stober, Christoph Jaeger (HTWK Leipzig), C.J. Stanbridge (Memorial U. of Newfoundland), Cody Hanson, Constantinos Georgiades, Dakota Cookenmaster (Southern Adventist), Dakota Crane (U. Washington-Tacoma), Dan Soendergaard (U. Aarhus), Dan Tsafrir (Technion), Daniel J Williams (IBM)*, Daniela Ferreira Franco Moura, Danilo Bruschi (Universita Degli Studi Di Milano), Darby Asher Noam Haller, David Hanle (Grinnell), David Hartman, Dawn Flood, Deepika Muthukumar, Demir Delic, Dennis Zhou, Dheeraj Shetty (North Carolina State), Diego Oleiarz (FaMAF UNC), dominikw1 (github), Dominic White, Dorian Arnold (New Mexico), Dustin Metzler, Dustin Passofaro, Dylan Kaplan, Eduardo Stelmaszczyk, Efkan S. Goktepe, Emad Sadeghi, Emil Hessman, Emily Jacobson, Emmett Witchel (Texas), Eric Freudenthal (UTEP), Erik Hjelmas, Eric Kleinberg, Eric Johansson, Erik Turk, Ernst Biersack (France), Ethan Wood, Evan Leung, Fangjun Kuang (U. Stuttgart), Feng Zhang (IBM), Finn Kuusisto*, Francesco Piccoli, Gavin Inglis (Notre Dame), Gia Hoang Tran, Giovanni Di Santi, Giovanni Lagorio (DIBRIS), Giovanni Moricca, Glenn Bruns (CSU Monterey Bay), Glen Granzow (College of Idaho), Greggory Van Dycke, Guilherme Baptista, gurugio (github), Tian Guo (WPI), Hamid Reza Ghasemi, Hao Chen, Hao Liu, Hein Meling (Stavanger), Helen Gaiser (HTWG Konstanz), Henry Abbey, Hilmar Gustafsson (Aalborg University), Holly Johnson (USF), Hrishikesh Amur, Huanchen Zhang*, Huseyin Sular, Hugo Diaz, Hyrum Carroll (Columbus State), Ilya Oblomkov, Itai Hass (Toronto), Jack Xu (Wisconsin), Jackson "Jake" Haenchen (Texas), Jacob Levinson (UCLA), Jaeyoung Cho (SKKU), Jagannathan Eachambadi, Jake Gillberg, Jakob Olandt, James Earley, James Perry (U. Michigan-Dearborn)*, Jan Reineke (Universitat des Saarlandes), Jason MacLafferty (Southern Adventist), Jason Waterman (Vassar), Jay Lim, Jerod Weinman (Grinnell), Jersey Deng (UCLA), Jhih-Cheng Luo, Jiao Dong (Rutgers), Jia-Shen Boon, Jiawen Bao, Jidong Xiao (Boise State), Jingxin Li, jmcruzGH (github), Joe Jean (NYU), Joel Kuntz (Saint Mary's), Joel Hassan (U. Helsinki), Joel Sommers (Colgate), John Brady (Grinnell), John Komenda, John McEachen (NPS), Jonathan Perry (MIT), Joshua Carpenter (NCSU), Josip Cavar, Jun He, Justinas Petuchovas, Kai Mast (Wisconsin), Karl Schultheisz, Karl Wallinger, Kartik Singhal, Katherine Dudenas, Katie Coyle (Georgia Tech), Kaushik Kannan, Kemal Bıçakcı, Kevin Liu*, Khaled Emara, Kyle Hale (Illinois Institute of Technology), KyoungSoo Park (KAIST), Kyutae Lee*, Lanyue Lu, Laura Xu, legate (github), Lei Tian (U. Nebraska-Lincoln), Leonardo Medici (U. Milan), Leslie Schultz, Liang Yin, Lihao Wang, Looserof, Louie Lu, Luigi Finetti (FaMAF, UNC), Luna Gal (Wooster), lyazj (github), Manav Batra (IIIT-Delhi), Manu Awasthi (Samsung), Marcel van der Holst, Marco Guazzone (U. Piemonte Orientale), Marco Pedrinazzi (Universita Degli Studi Di Milano), Marius Rodi, Mart Oskamp, Martha Ferris, Masashi Kishikawa (Sony), Matt Reichoff, Matías De Pascuale (FaMAF Universidad Nacional De Cordoba), Matthew Prinz, Matthias St. Pierre, Mattia Monga (U. Milan), Matty Williams, Megan Cutrofello, Meng Huang, Michael Machtel (Hochschule Konstanz), Michael Walfish (NYU), Michael Wu (UCLA), Mike Griepentrog, Ming Chen (Stonybrook), Mohammed Alali (Delaware), Mohamed Omran (GUST), Mondo Gao (Wisconsin), Muhammad Mobeen Movania, Muhammad Yasoob Ullah Khalid, Murat Kerim Aslan, Murugan Kandaswamy, Nadeem Shaikh, Nan Xiao, Natasha Eilbert, Natasha Stopa, Nathan Dipiazza, Nathan Sullivan, Neeraj Badlani (N.C. State), Neil Perry, Nelson Gomez, Neven Sajko, Nghia Huynh (Texas), Ngu (Nicholas) Q. Truong, Nicholas Mandal, Nick Weinandt, Nishin Shouzab, Nizare Leonetti, Noah Jackson, Otto Sievert, Patel Pratyush Ashesh (BITS-Pilani), Patricio Jara, Patrick Elsen, Patrizio Palmisano, Pavle Kostovic, Perry Kivolowitz, Peter Peterson (Minnesota), Phani Karan, Pieter Kockx, Po-Hao Su (Taiwan), Prabhsimrandeep Singh, Prairie Rose Goodwin, Radford Smith, Repon Kumar Roy, Reynaldo H. Verdejo Pinochet, Riccardo Mutschlechner, Rick Perry, Richard Campanha (Georgia Tech), Ripudaman Singh, Rita Pia Folisi, Robert Ordoñez and class (Southern Adventist), Robin Li (Cornell), Roger Wattenhofer (ETH), Rohan Das (Toronto)*, Rohan Pasalkar (Minnesota), Rohan Puri, Ross Aiken, Ruslan Kiselev, Ryland Herrick, Sam Kelly, Sam Noh (UNIST), Sameer Punjal, Samer Al-Kiswany, Sandeep Ummadi (Minnesota), Santiago Marini, Sankaralingam Panneerselvam, Sarvesh Tandon (Wisconsin), Satish Chebrolu (NetApp), Satyanarayana Shanmugam*, Scott Catlin, Scott Lee (UCLA), Scott Schoeller, Seth Pollen, Sharad Punuganti, Shawn Ge, Shivaram Venkataraman, Shreevatsa R., Simon Pratt (University of Waterloo), Sirui Chen, Sivaraman Sivaraman*, Song Jiang (Wayne State), Spencer Harston (Weber State), Srinivasan Thirunarayanan*, Stardustman (github), Stefan Dekanski, Stephen Bye, Stephen Schaub, Suriyhaprakhas Balaram Sankari, Sy Jin Cheah, Teri Zhao (EMC), Thanumalayan S. Pillai, thasinaz (github), Thomas Griebel, Thomas John Lesniak (Wisconsin), Thomas Scrace, Tianxia Bai, Tobi Popoola (Boise State), Tong He, Tongxin Zheng, Tony Adkins, Torin Rudeen (Princeton), Tuo Wang, Tyler Couto, Varun Vats, Vegard Stikbakke, Vikas Goel, Waciuma Wanjohi, William Royle (Grinnell), Winson Huang (github), Xiang Peng, Xu Di, Yanyan Jiang, Yifan Hao, Yuanyuan Chen, Yubin Ruan, Yudong Sun, Yue Zhuo (Texas A&M), Yufeng Zhang (UCLA), Yufui Ren, Yuxing Xiang (Peking), Zef RosnBrick, Zeyuan Hu (Texas), Zhengguang Zhou (Wisconsin), ZiHan Zheng (USTC), zino23 (github), Zuyu Zhang.</span>`,
        `위에서 별표(*)로 표시된 분들께 특별한 감사를 전합니다. 이분들은 개선을 위한 제안에서 그 이상의 노력을 보여주셨습니다.`,
        `이에 더해, 각 장에 대한 상세한 노트를 제공해 주신 Joe Meehean 교수님(Lynchburg)께, 놀라운 소책자를 만들어 주신 Jerod Weinman 교수님(Grinnell)과 그의 전체 수강생들께, 더없이 귀중하고 세심한 검토와 의견을 주신 Chien-Chung Shen 교수님(Delaware)께, 꼼꼼한 검토와 제안을 해주신 Adam Drescher(WUSTL)께, 믿기 어려울 만큼 상세한 의견과 팁을 주신 Glen Granzow(College of Idaho)께, 열정과 더불어 개선을 위한 상세한 제안을 해주신 Michael Walfish(NYU)께, 유용한 피드백과 논평을 많이 주신 Peter Peterson(UMD)께, 상세한 비평을 해주신 Mark Kampe(Pomona)께(모든 제안을 다 반영할 수 있었으면 좋았을 텐데요!), 그리고 한국어 번역 작업(!)과 수많은 통찰력 있는 제안을 해주신 Youjip Won(한양대) 교수님께, 또 메모리 매핑(memory mapping)에 관한 곁가지 설명을 써주신 Terence Kelly께 깊이 감사드립니다. 이 모든 분들이 이 자료들을 다듬는 데 헤아릴 수 없을 만큼 큰 도움을 주셨습니다.`,
        `이 책의 문체로 멋진 보안(security) 관련 장들을 모두 써주신 Peter Reiher 교수님(UCLA)께 특별한 감사를 드립니다. 우리는 여러 해 전에 Peter를 만나는 행운을 누렸는데, 그때만 해도 20년 뒤에 이런 식으로 협업하게 될 줄은 전혀 몰랐습니다. 정말 놀라운 작업이었습니다!`,
        `또한 여러 해에 걸쳐 537 강의를 수강한 수백 명의 학생들에게도 많은 감사를 전합니다. 특히 이 노트가 처음 글로 쓰이도록 독려해 준 2008년 가을 학기 수강생들(읽을 만한 교재가 없는 것에 신물이 났던 학생들, 참 채근도 많았죠!), 그리고 우리가 계속할 수 있을 만큼 그것을 칭찬해 준 학생들에게요(그해 강의 평가에 적힌 "이거 완전 교재로 내셔야 함!!"이라는 한 폭소를 자아낸 코멘트를 포함해서요).`,
        `또한 xv6 프로젝트 실습 과목을 들은 용감한 소수에게도 큰 빚을 졌습니다. 그 내용의 상당 부분이 이제 537 본강의에 통합되었습니다. 2009년 봄 학기: Justin Cherniak, Patrick Deline, Matt Czech, Tony Gregerson, Michael Griepentrog, Tyler Harter, Ryan Kroiss, Eric Radzikowski, Wesley Reardan, Rajiv Vaidyanathan, Christopher Waclawik. 2009년 가을 학기: Nick Bearson, Aaron Brown, Alex Bird, David Capel, Keith Gould, Tom Grim, Jeffrey Hugo, Brandon Johnson, John Kjell, Boyan Li, James Loethen, Will McCardell, Ryan Szaroletta, Simon Tso, Ben Yule. 2010년 봄 학기: Patrick Blesi, Aidan Dennis-Oehling, Paras Doshi, Jake Friedman, Benjamin Frisch, Evan Hanson, Pikkili Hemanth, Michael Jeung, Alex Langenfeld, Scott Rick, Mike Treffert, Garret Staus, Brennan Wall, Hans Werner, Soo-Young Yang, Carlos Griffin(거의).`,
        `비록 이들이 책을 직접 돕지는 않았지만, 우리 학생들은 우리가 시스템에 대해 아는 것 대부분을 가르쳐 주었습니다. 우리는 그들이 위스콘신에 있는 동안 정기적으로 이야기를 나누지만, 실제 작업은 전부 그들이 해냅니다. 그리고 그들이 자신이 무엇을 하고 있는지 우리에게 들려줌으로써, 우리는 매주 새로운 것을 배웁니다. 이 목록에는 다음과 같은 전직 박사 및 박사후연구원들이 포함됩니다. Aishwarya Ganesan, Florentina Popovici, Haryadi S. Gunawi, Joe Meehean, John Bent, Jun He, Kan Wu, Lanyue Lu, Lakshmi Bairavasundaram, Leo Arulraj, Muthian Sivathanu, Nathan Burnett, Nitin Agrawal, Ram Alagappan, Samer Al-Kiswany, Sriram Subramanian, Stephen Todd Jones, Sudarsun Kannan, Suli Yang, Swaminathan Sundararaman, Thanh Do, Thanumalayan S. Pillai, Timothy Denehy, Tyler Harter, Vijay Chidambaram, Vijayan Prabhakaran, Yiying Zhang, Yupu Zhang, Yuvraj Patel, Zev Weiss.`,
        `물론 다른 많은 학생들(학부생, 석사생)과 협력자들도 우리와 함께 논문을 공동 저술했습니다. 그분들께도 감사드립니다. 그분들이 누구인지는 우리 웹페이지나 DBLP에서 확인하실 수 있습니다.`,
        `우리 대학원생들은 주로 미국 국립과학재단(NSF), 에너지부 과학국(DOE), 그리고 산업계 보조금으로부터 연구비를 지원받아 왔습니다. 특히 여러 해에 걸친 지원에 대해 NSF에 깊이 감사드립니다. 우리의 연구가 이 책의 많은 장의 내용을 형성해 왔기 때문입니다.`,
        `이 책의 더 나은 표지를 요구한 Thomas Griebel께 감사드립니다. 비록 그의 구체적인 제안(공룡이라니, 믿어지나요?)을 받아들이지는 않았지만, 그가 아니었다면 표지에 핼리 혜성(Halley's comet)의 아름다운 그림이 실리는 일은 없었을 것입니다.`,
        `마지막으로 Aaron Brown에게도 깊은 감사를 빚졌습니다. 그는 여러 해 전(2009년 봄)에 이 강의를 처음 수강했고, 이후 xv6 실습 과목을 들었으며(2009년 가을), 마침내 약 2년간(2010년 가을부터 2012년 봄까지) 이 강의의 대학원 조교(TA)를 맡았습니다. 그의 끊임없는 노력은 프로젝트(특히 xv6 영역의 프로젝트)의 상태를 크게 개선했고, 그리하여 위스콘신의 수많은 학부생과 대학원생의 학습 경험을 더 낫게 만드는 데 기여했습니다. Aaron이라면 (그 특유의 간결한 방식으로) 이렇게 말하겠지요. "Thx."`
      ]
    },
    {
      h: "맺음말 (Final Words)",
      p: [
        `예이츠(Yeats)는 "교육이란 양동이를 채우는 것이 아니라 불을 지피는 것이다"라는 유명한 말을 남겼습니다. 그는 옳으면서도 동시에 틀렸습니다. 여러분은 '양동이를 어느 정도 채워야' 하며, 이 노트는 분명히 여러분 교육의 그 부분을 돕기 위해 여기 있습니다. 결국, 여러분이 구글에 면접을 보러 갔을 때 그들이 세마포어(semaphore)를 어떻게 쓰는지에 관한 까다로운 질문을 던진다면, 세마포어가 실제로 무엇인지 정도는 아는 것이 좋겠지요?`,
        `<span class="reader-fn">[6] 그가 실제로 이렇게 말했는지는 모르겠습니다. 많은 유명한 인용구가 그렇듯, 이 명언의 출처도 불분명합니다.</span>`,
        `하지만 예이츠의 더 큰 요점은 분명 정곡을 찌릅니다. 교육의 진정한 핵심은 여러분이 무언가에 흥미를 갖게 하고, 단지 어떤 수업에서 좋은 학점을 받기 위해 소화해야 하는 것이 아니라 그 주제에 대해 스스로 더 많이 배우게 만드는 것입니다. 우리 아버지 중 한 분(Remzi의 아버지 Vedat Arpaci)이 늘 말씀하셨듯이, "교실 너머에서 배우라(Learn beyond the classroom)."`,
        `우리는 이 노트를 만든 이유가, 여러분이 운영체제에 흥미를 갖게 하고, 그 주제에 대해 스스로 더 읽어보게 하며, 그 분야에서 진행 중인 흥미진진한 연구에 대해 교수님과 이야기 나누고, 심지어 그 연구에 직접 참여하게 만들기 위해서였습니다. 운영체제는 위대한 분야입니다(!). 컴퓨팅 역사를 깊고 중요한 방식으로 빚어낸, 흥미롭고 멋진 아이디어로 가득 차 있습니다. 이 불이 여러분 모두에게서 타오르지는 않으리라는 걸 이해하지만, 많은 이에게, 혹은 단 몇 명에게라도 타오르기를 바랍니다. 왜냐하면 일단 그 불이 지펴지고 나면, 바로 그때 여러분은 진정으로 무언가 위대한 일을 해낼 수 있게 되기 때문입니다. 그리고 그것이야말로 교육 과정의 진정한 핵심입니다. 나아가, 수많은 새롭고 매혹적인 주제를 공부하고, 배우고, 성숙해지며, 그리고 무엇보다 여러분의 마음에 불을 지피는 무언가를 찾는 것 말입니다.`,
        `<span class="reader-fn">Andrea와 Remzi<br>부부<br>위스콘신 대학교 컴퓨터 과학 교수<br>그리고 (바라건대) 불을 지피는 사람들</span>`,
        `<span class="reader-fn">[7] 이 말이 마치 우리가 과거에 방화범이었다는 걸 인정하는 것처럼 들린다면, 여러분은 아마 요점을 놓친 것입니다. 아마도요. 이게 좀 느끼하게 들린다면, 음, 실제로 느끼하기 때문입니다. 다만 그 점은 좀 너그러이 봐주셔야겠네요.</span>`
      ]
    }
  ]
};

/* 렌더링 */
(function renderReader() {
  const body = document.getElementById("readerBody");
  if (!body) return;
  const titleEl = document.getElementById("readerTitle");
  if (titleEl) titleEl.textContent = READER.title;
  let html = `<div class="reader-source">${READER.source}</div>`;
  READER.sections.forEach(s => {
    html += `<h3 class="reader-h">${s.h}</h3>`;
    s.p.forEach(par => { html += `<p class="reader-p">${par}</p>`; });
  });
  body.innerHTML = html;
})();

/* 글자 크기 조절 */
(function fontControls() {
  const body = document.getElementById("readerBody");
  if (!body) return;
  let size = 15;                       // px
  const apply = () => { body.style.fontSize = size + "px"; };
  const minus = document.getElementById("fontMinus");
  const plus = document.getElementById("fontPlus");
  if (minus) minus.onclick = () => { size = Math.max(11, size - 1); apply(); };
  if (plus) plus.onclick = () => { size = Math.min(24, size + 1); apply(); };
  apply();
})();
