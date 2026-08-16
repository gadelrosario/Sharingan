import pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class DraftMathTests(unittest.TestCase):
    def run_node(self,script):
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_all_sizes_and_corner_middle_slots(self):
        self.run_node("""const d=require('./js/draft-math-v1');for(const n of [8,9,10,11,12,13,14,15,16])for(const s of [1,Math.ceil(n/2),n]){for(let p=1;p<=n*17;p++){const t=d.teamForPick(p,n);if(t<1||t>n)process.exit(1)}const x=d.pickInfo({pick:1,size:n,userSlot:s,totalRounds:17});if(x.nextUserPick!==s)process.exit(2)}""")

    def test_remaining_count_includes_current_pick(self):
        self.run_node("""const d=require('./js/draft-math-v1');for(const n of [8,9,10,11,12,13,14,15,16]){const total=n*17;const picks=[];for(let p=1;p<=total;p++)if(d.teamForPick(p,n)===4)picks.push(p);for(const expected of [3,2,1]){const current=picks[picks.length-expected];if(d.remainingUserPicks({currentPick:current,size:n,userSlot:4,totalRounds:17})!==expected)process.exit(expected)}}""")

    def test_timeline_uses_selected_size(self):
        self.run_node("""const d=require('./js/draft-session-v1');const x=d.timeline([{pick:13,id:1}],new Map([[1,{name:'Player'}]]),12);if(x[0].round!==2||x[0].picks[0].label!=='2.01')process.exit(1)""")

if __name__=='__main__':unittest.main()
