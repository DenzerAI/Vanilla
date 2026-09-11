import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeChatMenu} from '../ui/chat-menu.mjs';
test('new chat leads in every view; grouping preserves action and disabled state', () => {
 const fired=[];
 const items=['privacy','rename','pin','share','fork','compact','new','archive'].map(id=>({id,disabled:id==='fork',action:()=>fired.push(id)}));
 const extra=['maximize-panel','close-panel'].map(id=>({id,action:()=>fired.push(id)}));
 const menu=arrangeChatMenu(items,extra);
 assert.deepEqual(menu.map(item=>item.id),['new','pin','rename','fork','compact','share','privacy','maximize-panel','close-panel','archive']);
 assert.deepEqual(menu.filter(item=>item.separatorBefore).map(item=>item.id),['fork','privacy','maximize-panel','archive']);
 assert.equal(menu.find(item=>item.id==='fork').disabled,true);
 for(const item of menu)item.action();
 assert.deepEqual(fired,menu.map(item=>item.id));
 assert.equal(arrangeChatMenu(items)[0].id,'new');
});
test('locked chats and empty groups have no leading or duplicate separator', () => {
 const menu=arrangeChatMenu([{id:'open'},{id:'new'}],[{id:'maximize-panel'},{id:'close-panel'}]);
 assert.deepEqual(menu.map(item=>item.id),['new','open','maximize-panel','close-panel']);
 assert.equal(menu[0].separatorBefore,false);
 assert.equal(menu[3].separatorBefore,false);
 assert.deepEqual(arrangeChatMenu([]),[]);
});
