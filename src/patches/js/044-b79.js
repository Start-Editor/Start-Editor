
(function () {
    'use strict';

    /* 初始舞台背景：把自定义 SVG 注册成内置资源。
       md5 由构建脚本按字节算出，与 costume 里的 assetId / md5ext 一致，
       这样资源加载器能直接命中，不需要走网络。 */
    var BACKDROP_MD5 = '9a6023af67d75a532067578c2b49aefc';
    var BACKDROP_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSI2NTYuMTU2MTYiIGhlaWdodD0iMzYwLjM2MDM2IiB2aWV3Qm94PSIwLDAsNjU2LjE1NjE2LDM2MC4zNjAzNiI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTguNDM4NDQsMC45MzA5MykiPjxnIHN0cm9rZS1taXRlcmxpbWl0PSIxMCI+PHBhdGggZD0iTTguNDM4NDQsMzU5LjQyOTQzdi0zNjAuMzYwMzZoNjU2LjE1NjE2djM2MC4zNjAzNnoiIGZpbGw9IiMwMDAwMDAiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjxwYXRoIGQ9Ik0yNi40NzIyNiwzMzEuOTY5NTV2LTMuNTMwNmgzMTEuNTc0NzF2My41MzA2eiIgZmlsbC1vcGFjaXR5PSIwLjMxNzY1IiBmaWxsPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4yMjM1MyIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjAuNSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48dGV4dCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyNC4xNjQwMSwzMDMuMjg4NjEpIHNjYWxlKDEuNjY2MzYsMS42NjYzNikiIGZvbnQtc2l6ZT0iNDAiIHhtbDpzcGFjZT0icHJlc2VydmUiIGZpbGwtb3BhY2l0eT0iMC4zNDUxIiBmaWxsPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4zMDk4IiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIGZvbnQtZmFtaWx5PSImcXVvdDvjg5Ljg6njgq7jg47op5LjgrQgUHJvIFczJnF1b3Q7LCAmcXVvdDtIaXJhZ2lubyBLYWt1IEdvdGhpYyBQcm8mcXVvdDssIE9zYWthLCAmcXVvdDvjg6HjgqTjg6rjgqomcXVvdDssIE1laXJ5bywgJnF1b3Q777yt77yzIO+8sOOCtOOCt+ODg+OCryZxdW90OywgJnF1b3Q7TVMgUEdvdGhpYyZxdW90OyIgZm9udC13ZWlnaHQ9Im5vcm1hbCIgdGV4dC1hbmNob3I9InN0YXJ0Ij48dHNwYW4geD0iMCIgZHk9IjAiPlN0YXJ0RWRpdG9yPC90c3Bhbj48L3RleHQ+PHBhdGggZD0iTTQzNy42NzMzLDEwMS4zNzQyN2MwLDAgOS45ODgwMywtMy4zNDEyIDIxLjAzNjc3LC0zLjU2OTAxYzI4Ljk2NDk1LC0wLjU5NzIyIDE1OS4yMDU3NywtMC4xNDczMyAxNTkuMjA1NzcsLTAuMTQ3MzNsLTEyLjM4Nzc5LDQ4LjMxMjQzaC03OC42NjI1NWwtMi40Nzc1NywxNDcuNDE0ODdsMTguNTgxNywwLjYxOTM5YzAsMCA4LjMyNDQ0LC0xLjc4MjU4IDEzLjI2NTY2LC02LjUxNjM3YzUuNzg1MzMsLTUuNTQyNDYgOC4zMTA5NywtMTQuNDQxNDggOC4xNDgxNiwtMTguODkxNmMtMC4xMTk2NywtMy4yNzA5NiAxLjQ4NTU1LC0xMC43ODk0NSAtMi42MzcxMiwtMTUuMDI1NThjLTYuNzkxMzUsLTYuOTc4MjYgLTIwLjYzNDg3LC0xMC4zNTY0NCAtMjAuNjM0ODcsLTEwLjM1NjQ0bC0xLjIzODc5LC00Ny4wNzM2NmMwLDAgMTYuODUzNTEsMC4zNDc4NyAzMC4xNDAzMiw1LjQ5NjUyYzEyLjgwNTE2LDQuOTYyMDIgMjEuOTQ0ODEsMTQuNjAzNTIgMjcuOTIxMjEsMjEuMTcyMThjMTAuNDg1ODYsMTEuNTI0OTkgMTcuNTA0MDcsNTAuMTM1NjggMTcuNTA0MDcsNTAuMTM1NjhjMCwwIC0xMC41MDIzLDMwLjExNDI2IC0yMS4zMzYxNiw0MS43NzM1NWMtNC4yNDcxMyw0LjU3MDcyIC05LjE5ODcsMTQuNjU0MzQgLTE4LjE3MzM2LDE5LjIwMjdjLTEzLjk0MTU2LDcuMDY1NTggLTMyLjMzOTc0LDcuNzc2MDcgLTMyLjMzOTc0LDcuNzc2MDdsLTE1Ny4zMjUxLDEuMjM4NzdsMTQuMjQ1OTcsLTQ3LjA3MzY0bDc5LjI4MTk1LC0xLjg1ODE2bDEuODU4MTYsLTQ4LjkzMTg0aC0zNS4zMDUyM2MwLDAgLTIwLjMyNjk0LC05LjM1MzkzIC0zNS40OTI4OCwtMjUuODQxOGMtMTIuMzUyOTMsLTEzLjQyOTY4IC0yMC4wMzEwOCwtMzMuMDUxNTIgLTIwLjcxMDM5LC00NC4zMDg1MmMtMC4wODE0MywtMS4zNDkzNiAtMS42MDk5OCwtNDAuMDMzMjMgMTUuMTcwNDYsLTQ5LjAwNDEyYzE2Ljc4MDQ0LC04Ljk3MDg5IDI0LjE1MjgxLDcuNjA1NDkgMzAuMDY1OTUsMjQuODIwNTRjMS45MzAyNCw1LjYxOTU1IC04Ljg0OTI5LDEwLjc2MTMgLTEwLjA3OTc5LDE5LjM4NDE0Yy0xLjE4NzMxLDguMzIwMTYgNy4xNTY1NywyMC4xODAzNCA5Ljc1MzI3LDIyLjY3NTQ3YzIyLjcxNjE2LDIxLjgyNzcyIDUxLjYzNTczLDEwLjk3MzI4IDUyLjQzNTg5LDcuMjI4MjFjMC44NDYyNSwtMy45NjA4MSAtMy43MDYyNCwtNTYuODQ2MzcgLTMuNzA2MjQsLTU2Ljg0NjM3bC00OC4yMjkzMyw2LjI5MzcyYzAsMCAtMzMuNjU2OTYsLTIwLjg2Njc4IC0zMS4wMDc2MSwtMjQuMzE4OTljMTIuMzA2MjIsLTE2LjAzNTQ4IDMzLjEyOTIsLTIzLjc4MDc5IDMzLjEyOTIsLTIzLjc4MDc5eiIgZmlsbC1vcGFjaXR5PSIwLjMwMTk2IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTQzMi42NzMzLDk2LjM3NDI3YzAsMCA5Ljk4ODAzLC0zLjM0MTIgMjEuMDM2NzcsLTMuNTY5MDFjMjguOTY0OTUsLTAuNTk3MjIgMTU5LjIwNTc3LC0wLjE0NzMzIDE1OS4yMDU3NywtMC4xNDczM2wtMTIuMzg3NzksNDguMzEyNDNoLTc4LjY2MjU1bC0yLjQ3NzU3LDE0Ny40MTQ4N2wxOC41ODE3LDAuNjE5MzljMCwwIDguMzI0NDQsLTEuNzgyNTggMTMuMjY1NjYsLTYuNTE2MzdjNS43ODUzMywtNS41NDI0NiA4LjMxMDk3LC0xNC40NDE0OCA4LjE0ODE2LC0xOC44OTE2Yy0wLjExOTY3LC0zLjI3MDk2IDEuNDg1NTUsLTEwLjc4OTQ1IC0yLjYzNzEyLC0xNS4wMjU1OGMtNi43OTEzNSwtNi45NzgyNiAtMjAuNjM0ODcsLTEwLjM1NjQ0IC0yMC42MzQ4NywtMTAuMzU2NDRsLTEuMjM4NzksLTQ3LjA3MzY2YzAsMCAxNi44NTM1MSwwLjM0Nzg3IDMwLjE0MDMyLDUuNDk2NTJjMTIuODA1MTYsNC45NjIwMiAyMS45NDQ4MSwxNC42MDM1MiAyNy45MjEyMSwyMS4xNzIxOGMxMC40ODU4NiwxMS41MjQ5OSAxNy41MDQwNyw1MC4xMzU2OCAxNy41MDQwNyw1MC4xMzU2OGMwLDAgLTEwLjUwMjMsMzAuMTE0MjYgLTIxLjMzNjE2LDQxLjc3MzU1Yy00LjI0NzEzLDQuNTcwNzIgLTkuMTk4NywxNC42NTQzNCAtMTguMTczMzYsMTkuMjAyN2MtMTMuOTQxNTYsNy4wNjU1OCAtMzIuMzM5NzQsNy43NzYwNyAtMzIuMzM5NzQsNy43NzYwN2wtMTU3LjMyNTEsMS4yMzg3N2wxNC4yNDU5NywtNDcuMDczNjRsNzkuMjgxOTUsLTEuODU4MTZsMS44NTgxNiwtNDguOTMxODRoLTM1LjMwNTIzYzAsMCAtMjAuMzI2OTQsLTkuMzUzOTMgLTM1LjQ5Mjg4LC0yNS44NDE4Yy0xMi4zNTI5MywtMTMuNDI5NjggLTIwLjAzMTA4LC0zMy4wNTE1MiAtMjAuNzEwMzksLTQ0LjMwODUyYy0wLjA4MTQzLC0xLjM0OTM2IC0xLjYwOTk4LC00MC4wMzMyMyAxNS4xNzA0NiwtNDkuMDA0MTJjMTYuNzgwNDQsLTguOTcwODkgMjQuMTUyODEsNy42MDU0OSAzMC4wNjU5NSwyNC44MjA1NGMxLjkzMDI0LDUuNjE5NTUgLTguODQ5MjksMTAuNzYxMyAtMTAuMDc5NzksMTkuMzg0MTRjLTEuMTg3MzEsOC4zMjAxNiA3LjE1NjU3LDIwLjE4MDM0IDkuNzUzMjcsMjIuNjc1NDdjMjIuNzE2MTYsMjEuODI3NzIgNTEuNjM1NzMsMTAuOTczMjggNTIuNDM1ODksNy4yMjgyMWMwLjg0NjI1LC0zLjk2MDgxIC0zLjcwNjI0LC01Ni44NDYzNyAtMy43MDYyNCwtNTYuODQ2MzdsLTQ4LjIyOTMzLDYuMjkzNzJjMCwwIC0zMy42NTY5NiwtMjAuODY2NzggLTMxLjAwNzYxLC0yNC4zMTg5OWMxMi4zMDYyMiwtMTYuMDM1NDggMzMuMTI5MiwtMjMuNzgwNzkgMzMuMTI5MiwtMjMuNzgwNzl6IiBmaWxsLW9wYWNpdHk9IjAuMzAxOTYiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIwIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNNDI3LjY3MzMsOTEuMzc0MjdjMCwwIDkuOTg4MDMsLTMuMzQxMiAyMS4wMzY3NywtMy41NjkwMWMyOC45NjQ5NSwtMC41OTcyMiAxNTkuMjA1NzcsLTAuMTQ3MzMgMTU5LjIwNTc3LC0wLjE0NzMzbC0xMi4zODc3OSw0OC4zMTI0M2gtNzguNjYyNTVsLTIuNDc3NTcsMTQ3LjQxNDg3bDE4LjU4MTcsMC42MTkzOWMwLDAgOC4zMjQ0NCwtMS43ODI1OCAxMy4yNjU2NiwtNi41MTYzN2M1Ljc4NTMzLC01LjU0MjQ2IDguMzEwOTcsLTE0LjQ0MTQ4IDguMTQ4MTYsLTE4Ljg5MTZjLTAuMTE5NjcsLTMuMjcwOTYgMS40ODU1NSwtMTAuNzg5NDUgLTIuNjM3MTIsLTE1LjAyNTU4Yy02Ljc5MTM1LC02Ljk3ODI2IC0yMC42MzQ4NywtMTAuMzU2NDQgLTIwLjYzNDg3LC0xMC4zNTY0NGwtMS4yMzg3OSwtNDcuMDczNjZjMCwwIDE2Ljg1MzUxLDAuMzQ3ODcgMzAuMTQwMzIsNS40OTY1MmMxMi44MDUxNiw0Ljk2MjAyIDIxLjk0NDgxLDE0LjYwMzUyIDI3LjkyMTIxLDIxLjE3MjE4YzEwLjQ4NTg2LDExLjUyNDk5IDE3LjUwNDA3LDUwLjEzNTY4IDE3LjUwNDA3LDUwLjEzNTY4YzAsMCAtMTAuNTAyMywzMC4xMTQyNiAtMjEuMzM2MTYsNDEuNzczNTVjLTQuMjQ3MTMsNC41NzA3MiAtOS4xOTg3LDE0LjY1NDM0IC0xOC4xNzMzNiwxOS4yMDI3Yy0xMy45NDE1Niw3LjA2NTU4IC0zMi4zMzk3NCw3Ljc3NjA3IC0zMi4zMzk3NCw3Ljc3NjA3bC0xNTcuMzI1MSwxLjIzODc3bDE0LjI0NTk3LC00Ny4wNzM2NGw3OS4yODE5NSwtMS44NTgxNmwxLjg1ODE2LC00OC45MzE4NGgtMzUuMzA1MjNjMCwwIC0yMC4zMjY5NCwtOS4zNTM5MyAtMzUuNDkyODgsLTI1Ljg0MThjLTEyLjM1MjkzLC0xMy40Mjk2OCAtMjAuMDMxMDgsLTMzLjA1MTUyIC0yMC43MTAzOSwtNDQuMzA4NTJjLTAuMDgxNDMsLTEuMzQ5MzYgLTEuNjA5OTgsLTQwLjAzMzIzIDE1LjE3MDQ2LC00OS4wMDQxMmMxNi43ODA0NCwtOC45NzA4OSAyNC4xNTI4MSw3LjYwNTQ5IDMwLjA2NTk1LDI0LjgyMDU0YzEuOTMwMjQsNS42MTk1NSAtOC44NDkyOSwxMC43NjEzIC0xMC4wNzk3OSwxOS4zODQxNGMtMS4xODczMSw4LjMyMDE2IDcuMTU2NTcsMjAuMTgwMzQgOS43NTMyNywyMi42NzU0N2MyMi43MTYxNiwyMS44Mjc3MiA1MS42MzU3MywxMC45NzMyOCA1Mi40MzU4OSw3LjIyODIxYzAuODQ2MjUsLTMuOTYwODEgLTMuNzA2MjQsLTU2Ljg0NjM3IC0zLjcwNjI0LC01Ni44NDYzN2wtNDguMjI5MzMsNi4yOTM3MmMwLDAgLTMzLjY1Njk2LC0yMC44NjY3OCAtMzEuMDA3NjEsLTI0LjMxODk5YzEyLjMwNjIyLC0xNi4wMzU0OCAzMy4xMjkyLC0yMy43ODA3OSAzMy4xMjkyLC0yMy43ODA3OXoiIGZpbGwtb3BhY2l0eT0iMC4zMDE5NiIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yMi43MDI3LDE1LjIyMDM3YzAsLTIuNzAwNyAyLjk5NTMzLC00Ljg5MDA0IDYuNjkwMjYsLTQuODkwMDRoMTMuMzgwNTNjMy4zNDUxMywwIDUuMDE3NywxLjIyMjUxIDYuNjkwMjYsMi40NDUwMmw2LjY5MDI2LDQuODkwMDRjMS42NzI1NywxLjIyMjUxIDMuMzQ1MTMsMi40NDUwMiA2LjY5MDI2LDIuNDQ1MDJoMjAuMDcwNzljMy4zNDUxMywwIDUuMDE3NywtMS4yMjI1MSA2LjY5MDI2LC0yLjQ0NTAybDYuNjkwMjYsLTQuODkwMDRjMS42NzI1NywtMS4yMjI1MSAzLjM0NTEzLC0yLjQ0NTAyIDYuNjkwMjYsLTIuNDQ1MDJoNzYuNjkwMjVjMy42OTQ5MywwIDYuNjkwMjYsMi4xODkzNSA2LjY5MDI2LDQuODkwMDR2NDguOTAwNDRjMCwyLjcwMDcgLTIuOTk1MzMsNC44OTAwNCAtNi42OTAyNiw0Ljg5MDA0aC03Ni42OTAyNWMtMy4zNDUxMywwIC01LjAxNzcsMS4yMjI1MSAtNi42OTAyNiwyLjQ0NTAybC02LjY5MDI2LDQuODkwMDRjLTEuNjcyNTcsMS4yMjI1MSAtMy4zNDUxMywyLjQ0NTAyIC02LjY5MDI2LDIuNDQ1MDJoLTIwLjA3MDc5Yy0zLjM0NTEzLDAgLTUuMDE3NywtMS4yMjI1MSAtNi42OTAyNiwtMi40NDUwMmwtNi42OTAyNiwtNC44OTAwNGMtMS42NzI1NywtMS4yMjI1MSAtMy4zNDUxMywtMi40NDUwMiAtNi42OTAyNiwtMi40NDUwMmgtMTMuMzgwNTNjLTMuNjk0OTMsMCAtNi42OTAyNiwtMi4xODkzNSAtNi42OTAyNiwtNC44OTAwNHoiIGZpbGw9IiNjYmNiY2IiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjxwYXRoIGQ9Ik0yMS42OTY3LDc3LjI3NzQzYzAsLTIuNzAwNyAyLjk5NTMzLC00Ljg5MDA1IDYuNjkwMjYsLTQuODkwMDVoMTMuMzgwNTJjMy4zNDUxMywwIDUuMDE3NywxLjIyMjUxIDYuNjkwMjYsMi40NDUwMmw2LjY5MDI2LDQuODkwMDVjMS42NzI1NywxLjIyMjUxIDMuMzQ1MTMsMi40NDUwMiA2LjY5MDI2LDIuNDQ1MDJoMjAuMDcwNzljMy4zNDUxMywwIDUuMDE3NjksLTEuMjIyNTEgNi42OTAyNiwtMi40NDUwMmw2LjY5MDI3LC00Ljg5MDA1YzEuNjcyNTcsLTEuMjIyNTEgMy4zNDUxMywtMi40NDUwMiA2LjY5MDI2LC0yLjQ0NTAyaDc2LjY5MDI1YzMuNjk0OTMsMCA2LjY5MDI2LDIuMTg5MzQgNi42OTAyNiw0Ljg5MDA1djQ4LjkwMDQ0YzAsMi43MDA3IC0yLjk5NTMzLDQuODkwMDUgLTYuNjkwMjYsNC44OTAwNWgtNzYuNjkwMjVjLTMuMzQ1MTMsMCAtNS4wMTc2OSwxLjIyMjUxIC02LjY5MDI2LDIuNDQ1MDJsLTYuNjkwMjcsNC44OTAwNGMtMS42NzI1NywxLjIyMjUxIC0zLjM0NTEzLDIuNDQ1MDIgLTYuNjkwMjYsMi40NDUwMmgtMjAuMDcwNzljLTMuMzQ1MTMsMCAtNS4wMTc3LC0xLjIyMjUxIC02LjY5MDI2LC0yLjQ0NTAybC02LjY5MDI2LC00Ljg5MDA0Yy0xLjY3MjU2LC0xLjIyMjUxIC0zLjM0NTEzLC0yLjQ0NTAyIC02LjY5MDI2LC0yLjQ0NTAyaC0xMy4zODA1MmMtMy42OTQ5MywwIC02LjY5MDI2LC0yLjE4OTM1IC02LjY5MDI2LC00Ljg5MDA1eiIgZmlsbD0iIzgxODE4MSIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjAiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTIwLjY5MDY5LDEzOS4zMzQ0OWMwLC0yLjcwMDcgMi45OTUzMywtNC44OTAwNSA2LjY5MDI2LC00Ljg5MDA1aDEzLjM4MDUyYzMuMzQ1MTMsMCA1LjAxNzcsMS4yMjI1MSA2LjY5MDI2LDIuNDQ1MDJsNi42OTAyNiw0Ljg5MDA0YzEuNjcyNTcsMS4yMjI1MSAzLjM0NTEzLDIuNDQ1MDMgNi42OTAyNiwyLjQ0NTAzaDIwLjA3MDc5YzMuMzQ1MTMsMCA1LjAxNzY5LC0xLjIyMjUyIDYuNjkwMjYsLTIuNDQ1MDNsNi42OTAyNywtNC44OTAwNGMxLjY3MjU3LC0xLjIyMjUxIDMuMzQ1MTMsLTIuNDQ1MDIgNi42OTAyNiwtMi40NDUwMmg3Ni42OTAyNWMzLjY5NDkzLDAgNi42OTAyNiwyLjE4OTM1IDYuNjkwMjYsNC44OTAwNXY0OC45MDA0NGMwLDIuNzAwNyAtMi45OTUzMyw0Ljg5MDA0IC02LjY5MDI2LDQuODkwMDRoLTc2LjY5MDI1Yy0zLjM0NTEzLDAgLTUuMDE3NjksMS4yMjI1MSAtNi42OTAyNiwyLjQ0NTAybC02LjY5MDI3LDQuODkwMDRjLTEuNjcyNTcsMS4yMjI1MSAtMy4zNDUxMywyLjQ0NTAyIC02LjY5MDI2LDIuNDQ1MDJoLTIwLjA3MDc5Yy0zLjM0NTEzLDAgLTUuMDE3NywtMS4yMjI1MSAtNi42OTAyNiwtMi40NDUwMmwtNi42OTAyNiwtNC44OTAwNGMtMS42NzI1NiwtMS4yMjI1MSAtMy4zNDUxMywtMi40NDUwMiAtNi42OTAyNiwtMi40NDUwMmgtMTMuMzgwNTJjLTMuNjk0OTMsMCAtNi42OTAyNiwtMi4xODkzNSAtNi42OTAyNiwtNC44OTAwNHoiIGZpbGw9IiMzMzMzMzMiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjxwYXRoIGQ9Ik00MjIuNjczMyw4Ni4zNzQyN2MwLDAgOS45ODgwMywtMy4zNDEyIDIxLjAzNjc3LC0zLjU2OTAxYzI4Ljk2NDk1LC0wLjU5NzIyIDE1OS4yMDU3NywtMC4xNDczMyAxNTkuMjA1NzcsLTAuMTQ3MzNsLTEyLjM4Nzc5LDQ4LjMxMjQzaC03OC42NjI1NWwtMi40Nzc1NywxNDcuNDE0ODdsMTguNTgxNywwLjYxOTM5YzAsMCA4LjMyNDQ0LC0xLjc4MjU4IDEzLjI2NTY2LC02LjUxNjM3YzUuNzg1MzMsLTUuNTQyNDYgOC4zMTA5NywtMTQuNDQxNDggOC4xNDgxNiwtMTguODkxNmMtMC4xMTk2NywtMy4yNzA5NiAxLjQ4NTU1LC0xMC43ODk0NCAtMi42MzcxMiwtMTUuMDI1NThjLTYuNzkxMzUsLTYuOTc4MjYgLTIwLjYzNDg3LC0xMC4zNTY0NCAtMjAuNjM0ODcsLTEwLjM1NjQ0bC0xLjIzODc5LC00Ny4wNzM2NmMwLDAgMTYuODUzNTEsMC4zNDc4NyAzMC4xNDAzMiw1LjQ5NjUyYzEyLjgwNTE2LDQuOTYyMDIgMjEuOTQ0ODEsMTQuNjAzNTIgMjcuOTIxMjEsMjEuMTcyMThjMTAuNDg1ODYsMTEuNTI0OTkgMTcuNTA0MDcsNTAuMTM1NjggMTcuNTA0MDcsNTAuMTM1NjhjMCwwIC0xMC41MDIzLDMwLjExNDI2IC0yMS4zMzYxNiw0MS43NzM1NWMtNC4yNDcxMyw0LjU3MDcyIC05LjE5ODcsMTQuNjU0MzQgLTE4LjE3MzM2LDE5LjIwMjdjLTEzLjk0MTU2LDcuMDY1NTggLTMyLjMzOTc0LDcuNzc2MDcgLTMyLjMzOTc0LDcuNzc2MDdsLTE1Ny4zMjUxLDEuMjM4NzdsMTQuMjQ1OTcsLTQ3LjA3MzY0bDc5LjI4MTk1LC0xLjg1ODE2bDEuODU4MTYsLTQ4LjkzMTg0aC0zNS4zMDUyM2MwLDAgLTIwLjMyNjk0LC05LjM1MzkzIC0zNS40OTI4OCwtMjUuODQxOGMtMTIuMzUyOTMsLTEzLjQyOTY4IC0yMC4wMzEwOCwtMzMuMDUxNTIgLTIwLjcxMDM5LC00NC4zMDg1MmMtMC4wODE0MywtMS4zNDkzNiAtMS42MDk5OCwtNDAuMDMzMjMgMTUuMTcwNDYsLTQ5LjAwNDEyYzE2Ljc4MDQ0LC04Ljk3MDg5IDI0LjE1MjgxLDcuNjA1NDkgMzAuMDY1OTUsMjQuODIwNTRjMS45MzAyNCw1LjYxOTU1IC04Ljg0OTI5LDEwLjc2MTMgLTEwLjA3OTc5LDE5LjM4NDE0Yy0xLjE4NzMxLDguMzIwMTYgNy4xNTY1NywyMC4xODAzNCA5Ljc1MzI3LDIyLjY3NTQ3YzIyLjcxNjE2LDIxLjgyNzcyIDUxLjYzNTczLDEwLjk3MzI4IDUyLjQzNTg5LDcuMjI4MjFjMC44NDYyNSwtMy45NjA4MSAtMy43MDYyNCwtNTYuODQ2MzcgLTMuNzA2MjQsLTU2Ljg0NjM3bC00OC4yMjkzMyw2LjI5MzcyYzAsMCAtMzMuNjU2OTYsLTIwLjg2Njc4IC0zMS4wMDc2MSwtMjQuMzE4OTljMTIuMzA2MjIsLTE2LjAzNTQ4IDMzLjEyOTIsLTIzLjc4MDc5IDMzLjEyOTIsLTIzLjc4MDc5eiIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjx0ZXh0IHRyYW5zZm9ybT0idHJhbnNsYXRlKDE5LjE2NDAxLDI5OC4yODg2MSkgc2NhbGUoMS42NjYzNiwxLjY2NjM2KSIgZm9udC1zaXplPSI0MCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBmb250LWZhbWlseT0iJnF1b3Q744OS44Op44Ku44OO6KeS44K0IFBybyBXMyZxdW90OywgJnF1b3Q7SGlyYWdpbm8gS2FrdSBHb3RoaWMgUHJvJnF1b3Q7LCBPc2FrYSwgJnF1b3Q744Oh44Kk44Oq44KqJnF1b3Q7LCBNZWlyeW8sICZxdW90O++8re+8syDvvLDjgrTjgrfjg4Pjgq8mcXVvdDssICZxdW90O01TIFBHb3RoaWMmcXVvdDsiIGZvbnQtd2VpZ2h0PSJub3JtYWwiIHRleHQtYW5jaG9yPSJzdGFydCI+PHRzcGFuIHg9IjAiIGR5PSIwIj5TdGFydEVkaXRvcjwvdHNwYW4+PC90ZXh0PjxwYXRoIGQ9Ik0yMi45NzM3NiwzMjguNDcxMDV2LTMuNTMwNmgzMTEuNTc0NzF2My41MzA2eiIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjAuNSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNNDMzLjE5MjkxLDExOS40OTU0NWMxLjc2Nzc2LDEuNzY3NzYgMCwzLjUzNTUzIDAsMy41MzU1M2wtMS4xNDYzOSwxLjA1NDExYy0xLjc5OTc2LDIuODcyNDQgLTMuOTYwODQsNS41MzgxNCAtNi4zNDk1NSw3Ljk0MzI2Yy0wLjIxNzI5LDAuMjIwMTUgLTAuNDc1MTQsMC40MDAxNiAtMC43NjE0MiwwLjUyNzk0Yy0wLjY3OTM3LDAuMzM1MTYgLTEuNzMyNTIsMC41MzY4NSAtMi43ODU2NywtMC41MTYzMWMtMS4wNTMxNiwtMS4wNTMxNiAtMC44NTE0NywtMi4xMDYzIC0wLjUxNjMsLTIuNzg1NjdjMC4xMjc3OSwtMC4yODYzMSAwLjMwNzgzLC0wLjU0NDE3IDAuNTI4LC0wLjc2MTQ4YzIuMTM0MjEsLTIuMTIxMDkgNC4wNTk1OSwtNC40ODc2MSA1LjYzOTIsLTcuMDQ4NWwxLjg1NjYxLC0xLjk0ODg5YzAsMCAxLjc2Nzc3LC0xLjc2Nzc2IDMuNTM1NTMsMHoiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIwLjUiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTM5Mi44ODkxLDEwNy43NDk3MWMwLC0xLjM4MDcxIDEuMTE5MjksLTIuNSAyLjUsLTIuNWMxLjM4MDcxLDAgMi41LDEuMTE5MjkgMi41LDIuNWMwLDEuMzgwNzEgLTEuMTE5MjksMi41IC0yLjUsMi41Yy0xLjM4MDcxLDAgLTIuNSwtMS4xMTkyOSAtMi41LC0yLjV6IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMC41IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjwvZz48L2c+PC9zdmc+PCEtLXJvdGF0aW9uQ2VudGVyOjMxMS41NjE1NjoxODAuOTMwOTMtLT4K';

    function installBackdropAsset() {
        var R = window.__RES__;
        if (!R) return false;
        var ext = BACKDROP_MD5 + '.svg';
        /* 资源表里的键形如 static/assets/<md5>.svg，两种写法都注册，
           避免不同查找路径命中不到 */
        R[ext] = BACKDROP_DATA_URI;
        R['static/assets/' + ext] = BACKDROP_DATA_URI;
        return true;
    }

    /* ---------------------------------------------------------------- *
     * 顶层宿主
     *
     * 之前这些浮层各自挂在自己的父节点上：
     *   · 主题轮盘 → 挂在菜单栏里（position:absolute）
     *   · 搜索框 / 贴靠面板 / 油猴窗口 → 挂在 body 上
     * 问题在于【层叠上下文】：菜单栏这类容器自身带有 z-index，
     * 于是轮盘的 z-index 只在菜单栏内部生效，无论调到多大，
     * 只要菜单栏整体低于别的面板（舞台、弹窗、窗口），轮盘就会被压住 ——
     * 这就是"图层错位"，而且靠调大 z-index 根本治不好。
     *
     * 现在统一放进一个挂到 <html> 的宿主：宿主自身 z-index 极高，
     * 又不带 transform / filter（不会给内部 fixed 元素造成定位偏移），
     * 内部元素一律相对视口定位，自然位于所有编辑器面板之上。
     * 宿主 pointer-events:none，可交互的子元素各自声明 auto。
     * ---------------------------------------------------------------- */
    var TOP_Z = 999998;   /* 低于编辑器的全屏确认框(999999)，避免挡住"是否离开"这类关键提示 */

    function blTopLayer() {
        var h = document.getElementById('bl-top-layer');
        if (h) return h;
        h = document.createElement('div');
        h.id = 'bl-top-layer';
        h.className = 'bl-top-layer';
        h.style.position = 'fixed';
        h.style.left = '0';
        h.style.top = '0';
        h.style.width = '100%';
        h.style.height = '100%';
        h.style.zIndex = String(TOP_Z);
        h.style.pointerEvents = 'none';
        (document.documentElement || document.body).appendChild(h);
        return h;
    }

    /* ================================================================= *
     * 统一弹窗动画
     *
     * 所有弹窗（各类窗口、主题面板、搜索框）共用同一组参数，
     * 由 .bl-pop 这个"关闭态"类驱动，见 inject.css 里的说明。
     * 这里只提供开关两个动作，各模块负责在合适的时机调用。
     * ================================================================= */

    var POP_MS = 130;   /* 入场更利落，点开窗口不拖泥带水 */
    var EXIT_MS = 110;  /* 出场：点 × / 最小化后立刻有反馈 */
    var POP_EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1.1)';
    var POP_FROM = { opacity: '0', transform: 'translateY(-6px) scale(0.985)' };
    var POP_TO = { opacity: '1', transform: 'none' };

    /* 弹窗动画预设：入场/出场/最小化各可选，生成对应的关键帧对。
       返回 [from, to]；'none' 返回 null 表示无动画。 */
    function animPreset(type) {
        var from;
        switch (type) {
            case 'scale':
            case 'genie': from = { opacity: '0', transform: 'scale(0.9)' }; break;
            case 'slideUp': from = { opacity: '0', transform: 'translateY(24px)' }; break;
            case 'slideDown': from = { opacity: '0', transform: 'translateY(-24px)' }; break;
            case 'slideLeft': from = { opacity: '0', transform: 'translateX(24px)' }; break;
            case 'slideRight': from = { opacity: '0', transform: 'translateX(-24px)' }; break;
            case 'fade': from = { opacity: '0' }; break;
            case 'none': return null;
            default: from = { opacity: '0', transform: 'translateY(-6px) scale(0.985)' }; break;
        }
        return [from, POP_TO];
    }
    function animType(which) {
        try {
            var a = window.__blSettings ? window.__blSettings.get('winAnimation') : null;
            if (a && a[which]) return a[which];
        } catch (e) { /* ignore */ }
        return which === 'minimize' ? 'genie' : 'fade';
    }

    function reduceMotion() {
        try {
            return !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) { return false; }
    }

    /* =====================================================================
       ⚠ 为什么用 Web Animations API 而不是切 class + transition：

       CSS 过渡需要"变化前样式"。窗口在 appendChild 之后往往已经被
       placeSeaWin() 之类的定位代码读过一次布局 —— 此刻样式已定型为
       opacity:1。后面再加 .bl-pop，浏览器认为这是一次 1→0 的过渡，
       于是立刻读到的计算值仍是 1（过渡的起点），紧接着又把类删掉，
       两次变化落在同一帧内，过渡根本没有推进的机会 —— 动画就这样
       无声地消失了。同一个新建的空 div 反而正常，正是因为它还没有
       "变化前样式"。

       WAAPI 不依赖"变化前样式"，直接按关键帧播放，行为确定。
       ===================================================================== */
    /* 清掉上一次动画留下的 fill:forwards 与 .bl-pop。
       .bl-pop 带 opacity/transform 的 !important，会盖掉 WAAPI 关键帧 ——
       这正是「有的自定义动画看起来完全没生效」的原因。 */
    function cleanAnim(el) {
        if (!el) return;
        try { el.classList.remove('bl-pop'); } catch (e) { /* ignore */ }
        try {
            if (el.getAnimations) {
                var as = el.getAnimations();
                for (var i = 0; i < as.length; i++) {
                    if (as[i].playState === 'finished' || as[i].playState === 'idle') {
                        try { as[i].cancel(); } catch (e2) { /* ignore */ }
                    }
                }
            }
        } catch (e3) { /* ignore */ }
    }

    function popIn(el) {
        if (!el) return;
        cleanAnim(el);
        if (!el.animate) return;
        try {
            var fr = animPreset(animType('enter'));
            if (!fr) { el.classList.remove('bl-pop-anim'); return; }
            el.classList.add('bl-pop-anim');
            var a = el.animate(fr, {
                duration: (el && el.__blPopMs) || POP_MS, easing: POP_EASE, fill: 'none'
            });
            /* 动画结束就摘掉 bl-pop-anim：它常驻时 left/top/width/height
               的 0.22s 过渡会让「最大化 / 最小化」点击迟钝。 */
            var endIn = function () {
                try { el.classList.remove('bl-pop-anim'); } catch (e) { /* ignore */ }
            };
            if (a) { a.onfinish = endIn; a.oncancel = endIn; }
        } catch (e) { /* ignore */ }
    }

    /* 关闭：播放反向动画，结束后再交给调用方摘节点 / 隐藏。
       done 一定会被调用（有兜底定时器），不会出现"关不掉"。 */
    function popOut(el, done) {
        if (!el) { done(); return; }
        cleanAnim(el);
        var fired = false;
        var timer = null;
        var fin = function () {
            if (fired) return;
            fired = true;
            if (timer) window.clearTimeout(timer);
            try { el.classList.remove('bl-pop-anim'); } catch (e) { /* ignore */ }
            try { done(); } catch (e2) { /* ignore */ }
        };
        if (!el.animate) { fin(); return; }
        var anim = null;
        try {
            /* 最小化按钮点下时先打上标记，这里就改用「最小化动画」预设，
               让设置页里那一项不再是摆设。 */
            var kind = el.getAttribute('data-bl-close-anim') || 'exit';
            el.removeAttribute('data-bl-close-anim');
            /* 最小化动画由 [B79] 在 window 捕获阶段统一驱动：各模块的最小化
               并不经过 popOut，而是在捕获阶段直接把窗口隐藏收进 DOCK。
               这里只保留通用出场动画，避免同一窗口被播两次。 */
            var fr = animPreset(animType(kind));
            if (!fr) { fin(); return; }
            el.classList.add('bl-pop-anim');
            anim = el.animate([fr[1], fr[0]], {
                duration: (el && el.__blExitMs) || EXIT_MS, easing: 'ease', fill: 'forwards'
            });
        } catch (e) { anim = null; }
        /* 兜底只比动画多 40ms，不再让点击后干等 240ms */
        timer = window.setTimeout(fin, EXIT_MS + 40);
        if (anim) {
            anim.onfinish = fin;
            anim.oncancel = fin;
        } else {
            fin();
        }
    }

    /* 编辑器自己用 React 创建的窗口（设置、插件设置等）不受我们控制，
       只能观察到插入后补一个出现动画 —— 关闭由 React 管，无法拦截，
       所以这类窗口只有打开动画。 */
    function watchNativeWindows() {
        if (!window.MutationObserver) return;
        var mo = new MutationObserver(function (recs) {
            for (var i = 0; i < recs.length; i++) {
                var added = recs[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var n = added[j];
                    if (!n || n.nodeType !== 1) continue;
                    var list = [n];
                    if (n.querySelectorAll) {
                        var inner = n.querySelectorAll('.addon-window');
                        for (var k = 0; k < inner.length; k++) list.push(inner[k]);
                    }
                    for (var m = 0; m < list.length; m++) {
                        var el = list[m];
                        if (!el.classList || !el.classList.contains('addon-window')) continue;
                        if (el.getAttribute('data-bl-pop')) continue;
                        el.setAttribute('data-bl-pop', '1');
                        popIn(el);
                    }
                }
            }
        });
        try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
    }

    try { window.__blTopLayer = blTopLayer; } catch (e) { /* ignore */ }
    /* ⚠ 这里的导出必须放在 popIn 被包装"之后"。
       之前写在前面，导出的仍是包装前的原始函数 —— 于是外部
       （唱片机等）拿到的 popIn 不会清掉上一次关闭动画留下的
       fill:forwards。表现是：窗口第二次打开时先出现一下，
       动画结束又变回 opacity:0，看起来像"打开后自动关闭"。 */
    try { window.__blPop = { in: popIn, out: popOut, ms: POP_MS }; } catch (e) { /* ignore */ }
    /* 打开时清掉上一次关闭动画的 fill:forwards 残留 */
    var rawPopIn = popIn;
    popIn = function (el) {
        try {
            if (el && el.getAnimations) {
                var as = el.getAnimations();
                for (var i = 0; i < as.length; i++) {
                    if (as[i].playState === 'finished') as[i].cancel();
                }
            }
        } catch (e) { /* ignore */ }
        rawPopIn(el);
        /* 新窗口是点开才建的，里面那批"白字 + 强调色底"此前不存在，
           光靠主题事件 / resize 扫不到，必须开窗口时补扫一次。 */
        try { scheduleReadable(); } catch (e) { /* ignore */ }
    };
    try { window.__blPop = { in: popIn, out: popOut, ms: POP_MS }; } catch (e) { /* ignore */ }

    var STORE_THEME = 'bilup.appTheme';
    var TRANSITION_CLASS = 'bl-theme-transition';

    /* 主题按钮与面板的 DOM 引用。
       ⚠ 这两个必须显式声明：脚本整体是严格模式（'use strict'），
       给未声明的变量赋值会抛 ReferenceError。而 mount() 是 tickOnce()
       的第一行，一旦抛错，后面的 patchZoom / installSmoothScroll
       就全部不执行 —— 表现为"主题按钮不出现 + 滚动缩放动画全没了"。 */
    var rootEl = null;
    var themeBtn = null;
    /* 第 33 轮：关闭动画要跑 EXIT_MS+40ms，期间 class 上还挂着 is-open。
       旧版 togglePanel 直接读 class，于是「关掉后马上再点」被当成继续关闭，
       表现就是有时点不开主题。这里改用逻辑开关 + 代号，
       迟到的关闭回调一律作废。 */
    var panelOpen = false;
    var panelGen = 0;
    var delegatesInstalled = false;

    /* ================================================================== *
     * 小工具
     * ================================================================== */

    function readStore(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function writeStore(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }
    function each(selector, fn) {
        var list = document.querySelectorAll(selector);
        for (var i = 0; i < list.length; i++) fn(list[i]);
    }

    /* 所有 CSS 变量写入都走这里：
       1) 只写变化过的键，避免无意义的样式失效
       2) 全程不读取布局，不触发强制同步重排 */
    var lastVars = Object.create(null);
    /* 编辑器自行重绘主题时也会直接写内联变量，此时缓存会失效，需要强制重写 */
    function resetVarCache() { lastVars = Object.create(null); }
    /* [B114] 浮层底色一律不透明：无论渐变预览、自定义主题、旧存档恢复
       还是编辑器自己重绘，只要落到弹窗专用变量上就把 alpha 去掉。
       这一层兜底覆盖所有写入路径，不依赖调用方是否走 applyGradLayer。 */
    var SOLID_VAR = {
        'ui-modal-background': 1, 'ui-modal-header-background': 1,
        'ui-white': 1, 'popover-background': 1,
        'input-background': 1, 'badge-background': 1
    };
    function solidVar(key, v) {
        if (!SOLID_VAR[key]) return v;
        var str = String(v == null ? '' : v).trim();
        var m = /^hsla\(\s*(.+?)\s*,\s*[\d.]+\s*\)$/i.exec(str);
        if (m) return 'hsl(' + m[1] + ')';
        m = /^rgba\(\s*(.+?)\s*,\s*[\d.]+\s*\)$/i.exec(str);
        if (m) return 'rgb(' + m[1] + ')';
        if (/^#[0-9a-f]{8}$/i.test(str)) return str.slice(0, 7);
        return v;
    }
    function flushVars(obj) {
        var root = document.documentElement;
        var style = root.style;
        var key;
        /* [B115] 玻璃开启时浮层变量保留 alpha，交给玻璃表接管；
           玻璃关闭时才把浮层底色钉成实色（上一轮 B114 的修复）。 */
        var glassOn = !!(root.classList && root.classList.contains &&
                         root.classList.contains('bl-dock-glass-on'));
        for (key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
            var val = glassOn ? obj[key] : solidVar(key, obj[key]);
            if (lastVars[key] === val) continue;
            style.setProperty('--' + key, val);
            lastVars[key] = val;
        }
    }

    /* ================================================================== *
     * 主题表
     * ================================================================== */

    /* 切换前先把这些变量复位到亮色基线，避免来回切留下残值 */
    var BASE = {
        'color-scheme': 'light',
        'ui-primary': 'hsla(215, 100%, 95%, 1)',
        'ui-secondary': 'hsla(215, 75%, 95%, 1)',
        'ui-tertiary': 'hsla(215, 50%, 90%, 1)',
        'ui-modal-overlay': 'var(--motion-primary-transparent)',
        'ui-modal-background': 'hsla(0, 100%, 100%, 1)',
        'ui-modal-foreground': 'hsla(225, 15%, 40%, 1)',
        'ui-modal-header-background': 'var(--looks-secondary)',
        'ui-modal-header-foreground': 'hsla(0, 100%, 100%, 1)',
        'ui-white': 'hsla(0, 100%, 100%, 1)',
        'ui-white-dim': 'hsla(0, 100%, 100%, 0.75)',
        'ui-white-transparent': 'hsla(0, 100%, 100%, 0.25)',
        'ui-transparent': 'hsla(0, 100%, 100%, 0)',
        'ui-black-transparent': 'hsla(0, 0%, 0%, 0.15)',
        'text-primary': 'hsla(225, 15%, 40%, 1)',
        'text-primary-transparent': 'hsla(225, 15%, 40%, 0.75)',
        'red-primary': 'hsla(20, 100%, 55%, 1)',
        'red-tertiary': 'hsla(20, 100%, 45%, 1)',
        'sound-primary': 'hsla(300, 53%, 60%, 1)',
        'sound-tertiary': 'hsla(300, 48%, 50%, 1)',
        'control-primary': 'hsla(38, 100%, 55%, 1)',
        'data-primary': 'hsla(30, 100%, 55%, 1)',
        'pen-primary': 'hsla(163, 85%, 40%, 1)',
        'pen-transparent': 'hsla(163, 85%, 40%, 0.25)',
        'pen-tertiary': 'hsla(163, 86%, 30%, 1)',
        'error-primary': 'hsla(30, 100%, 55%, 1)',
        'error-light': 'hsla(30, 100%, 70%, 1)',
        'error-transparent': 'hsla(30, 100%, 55%, 0.25)',
        'extensions-primary': 'hsla(163, 85%, 40%, 1)',
        'extensions-tertiary': 'hsla(163, 85%, 30%, 1)',
        'extensions-transparent': 'hsla(163, 85%, 40%, 0.35)',
        'extensions-light': 'hsla(163, 57%, 85%, 1)',
        'drop-highlight': 'hsla(215, 100%, 77%, 1)',
        'menu-bar-background': 'var(--looks-secondary)',
        'menu-bar-background-image': 'none',
        'menu-bar-foreground': '#ffffff',
        'assets-background': '#ffffff',
        'input-background': '#ffffff',
        'popover-background': '#ffffff',
        'badge-background': '#dbebff',
        'badge-border': '#b9d6ff',
        'fullscreen-background': '#ffffff',
        'fullscreen-accent': '#e8edf1',
        'page-background': '#ffffff',
        'page-foreground': '#000000',
        'project-title-inactive': 'var(--ui-white-transparent)',
        'project-title-hover': '#ffffff7f',
        'link-color': '#2255dd',
        'filter-icon-black': 'none',
        'filter-icon-gray': 'grayscale(100%)',
        'filter-icon-white': 'none',
        'paint-ui-pane-border': 'var(--ui-black-transparent)',
        'paint-text-primary': 'var(--text-primary)',
        'paint-form-border': 'var(--ui-black-transparent)',
        'paint-looks-secondary': 'var(--looks-secondary)',
        'paint-looks-transparent': 'var(--looks-transparent)',
        'paint-input-background': 'var(--input-background)',
        'paint-popover-background': 'var(--popover-background)',
        'paint-filter-icon-gray': 'none'
    };

    /* 工作区（积木画布 / 工具栏 / 抽屉）配色：跟随界面主题 */
    var WORKSPACE = {
        light: {
            'editorTheme3-workspace-background': '#ffffff',
            'editorTheme3-toolbox-background': '#ffffff',
            'editorTheme3-flyout-background': '#ffffff',
            'editorTheme3-toolbox-text': '#575e75',
            'editorTheme3-flyout-text': '#575e75',
            'editorTheme3-grid-color': '#dfe4ea',
            'editorTheme3-scrollbar': '#cecdce'
        },
        sakura: {
            'editorTheme3-workspace-background': '#fff6f9',
            'editorTheme3-toolbox-background': '#fbeaf1',
            'editorTheme3-flyout-background': '#fdf6f9',
            'editorTheme3-toolbox-text': '#7d4157',
            'editorTheme3-flyout-text': '#7d4157',
            'editorTheme3-grid-color': '#f3cbd9',
            'editorTheme3-scrollbar': '#e3b7c8'
        },
        dark: {
            'editorTheme3-workspace-background': '#1e1e1e',
            'editorTheme3-toolbox-background': '#111111',
            'editorTheme3-flyout-background': '#111111',
            'editorTheme3-toolbox-text': '#cccccc',
            'editorTheme3-flyout-text': '#cccccc',
            'editorTheme3-grid-color': '#484848',
            'editorTheme3-scrollbar': '#666666'
        },
        deepsea: {
            'editorTheme3-workspace-background': '#0d2136',
            'editorTheme3-toolbox-background': '#0a1b2c',
            'editorTheme3-flyout-background': '#0a1b2c',
            'editorTheme3-toolbox-text': '#cfe3f5',
            'editorTheme3-flyout-text': '#cfe3f5',
            'editorTheme3-grid-color': '#1d3f60',
            'editorTheme3-scrollbar': '#2b4c6e'
        }
    };

    var THEMES = {
        light: {
            label: '亮色', swatch: '#dfeaf9', rgb: '229, 240, 255',
            blocksId: 'three', category: null, dark: false, gui: {}
        },
        dark: {
            label: '暗色', swatch: '#1f2329', rgb: '17, 17, 17',
            blocksId: 'dark', category: null, dark: true,
            gui: {
                'color-scheme': 'dark',
                'ui-primary': '#111111', 'ui-secondary': '#1e1e1e', 'ui-tertiary': '#2e2e2e',
                'ui-modal-overlay': '#333333aa', 'ui-modal-background': '#111111',
                'ui-modal-foreground': '#eeeeee', 'ui-modal-header-background': '#333333',
                'ui-modal-header-foreground': '#ffffff', 'ui-white': '#111111',
                'ui-black-transparent': '#ffffff26', 'text-primary': '#eeeeee',
                'menu-bar-background': '#333333', 'assets-background': '#111111',
                'input-background': '#1e1e1e', 'popover-background': '#1e1e1e',
                'badge-background': '#16202c', 'badge-border': '#203652',
                'fullscreen-background': '#111111', 'fullscreen-accent': '#111111',
                'page-background': '#111111', 'page-foreground': '#eeeeee',
                'project-title-inactive': 'var(--ui-secondary)', 'project-title-hover': '#ffffff3f',
                'link-color': '#44aaff', 'filter-icon-black': 'invert(100%)',
                'filter-icon-gray': 'grayscale(100%) brightness(1.7)',
                'filter-icon-white': 'brightness(0) invert(100%)',
                'paint-filter-icon-gray': 'brightness(1.7)'
            }
        },
        sakura: {
            label: '樱花', swatch: '#f6c3d8', rgb: '253, 246, 249',
            blocksId: 'three', category: 'sakura', dark: false,
            gui: {
                'color-scheme': 'light',
                'ui-primary': '#fdf6f9', 'ui-secondary': '#fbeaf1', 'ui-tertiary': '#f6d9e6',
                'ui-modal-overlay': 'rgba(122, 44, 74, 0.3)', 'ui-modal-background': '#fffafc',
                'ui-modal-foreground': '#6d3b50', 'ui-modal-header-background': '#e78aae',
                'ui-modal-header-foreground': '#ffffff', 'ui-white': '#fffafc',
                'ui-white-dim': 'hsla(330, 60%, 99%, 0.75)',
                'ui-white-transparent': 'hsla(330, 60%, 99%, 0.25)',
                'ui-transparent': 'hsla(330, 60%, 99%, 0)',
                'ui-black-transparent': 'hsla(330, 30%, 30%, 0.15)',
                'text-primary': '#6d3b50',
                'text-primary-transparent': 'hsla(334, 30%, 34%, 0.75)',
                'drop-highlight': 'hsla(334, 80%, 84%, 1)',
                'menu-bar-background': '#e78aae', 'menu-bar-background-image': 'none',
                'menu-bar-foreground': '#ffffff', 'assets-background': '#fff6f9',
                'input-background': '#fffafc', 'popover-background': '#fffafc',
                'badge-background': '#ffe0ec', 'badge-border': '#f9bfd6',
                'fullscreen-background': '#fff6f9', 'fullscreen-accent': '#ffe7f0',
                'page-background': '#fff6f9', 'page-foreground': '#5c2f44',
                'project-title-inactive': 'var(--ui-white-transparent)',
                'project-title-hover': '#ffffff7f', 'link-color': '#c2185b',
                'filter-icon-black': 'none', 'filter-icon-gray': 'grayscale(100%)',
                'filter-icon-white': 'none', 'paint-filter-icon-gray': 'none'
            }
        },
        deepsea: {
            label: '深海', swatch: '#123a5e', rgb: '10, 27, 44',
            blocksId: 'dark', category: 'deepsea', dark: true,
            gui: {
                'color-scheme': 'dark',
                'ui-primary': '#0a1b2c', 'ui-secondary': '#11263c', 'ui-tertiary': '#1c3550',
                'ui-modal-overlay': '#040d18aa', 'ui-modal-background': '#0a1b2c',
                'ui-modal-foreground': '#d6e8f7', 'ui-modal-header-background': '#15314e',
                'ui-modal-header-foreground': '#ffffff', 'ui-white': '#0a1b2c',
                'ui-black-transparent': '#ffffff26', 'text-primary': '#d6e8f7',
                'menu-bar-background': '#123a5e', 'assets-background': '#0a1b2c',
                'input-background': '#11263c', 'popover-background': '#11263c',
                'badge-background': '#0f2438', 'badge-border': '#1b3c5c',
                'fullscreen-background': '#0a1b2c', 'fullscreen-accent': '#0a1b2c',
                'page-background': '#0a1b2c', 'page-foreground': '#d6e8f7',
                'project-title-inactive': 'var(--ui-secondary)', 'project-title-hover': '#ffffff3f',
                'link-color': '#4fc3f7', 'filter-icon-black': 'invert(100%)',
                'filter-icon-gray': 'grayscale(100%) brightness(1.7)',
                'filter-icon-white': 'brightness(0) invert(100%)',
                'paint-filter-icon-gray': 'brightness(1.7)'
            }
        }
    };

    /* ================================================================== *
     * 自定义主题色
     *
     * 需求：点「主题」后在按钮下方弹出面板，里面是分好类的预设色板；
     * 色板底部有「自定义主题色」，点开可自己配色（渐变编辑器）。
     *
     * 设计要点：主题不是一条条手写出来的，而是由【主色 + 明暗】派生。
     * 手写一个主题要写 40 多个 --ui-* 变量，自定义主题不可能让用户填这么多；
     * 派生函数负责把 1 个主色展开成完整色板（背景/面板/文字/菜单条/弹窗…），
     * 预设色板和用户自建主题共用同一条路径，观感才一致。
     * ================================================================== */

    var CUSTOM_STORE = 'bilup.customThemes';

    /* ---------------- 颜色工具 ---------------- */

    function clampN(v, a, b) { return v < a ? a : (v > b ? b : v); }

    function hexToRgb(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return { r: 76, g: 151, b: 255 };
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16)
        };
    }

    function toHex2(v) {
        v = Math.round(clampN(v, 0, 255));
        var t = v.toString(16);
        return t.length < 2 ? '0' + t : t;
    }

    function rgbToHex(r, g, b) {
        return '#' + toHex2(r) + toHex2(g) + toHex2(b);
    }

    /* 返回 h:0-360  s:0-100  l:0-100 */
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var h = 0, s = 0, l = (mx + mn) / 2;
        var d = mx - mn;
        if (d > 0) {
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return { h: h, s: s * 100, l: l * 100 };
    }

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360; s = clampN(s, 0, 100) / 100; l = clampN(l, 0, 100) / 100;
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = l - c / 2;
        var r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    }

    function hslHex(h, s, l) {
        var c = hslToRgb(h, s, l);
        return rgbToHex(c.r, c.g, c.b);
    }

    /* hsl() 字符串，保留小数避免大批量取整后色阶断裂 */
    function hslCss(h, s, l) {
        return 'hsl(' + (Math.round(h * 10) / 10) + ', ' +
            (Math.round(clampN(s, 0, 100) * 10) / 10) + '%, ' +
            (Math.round(clampN(l, 0, 100) * 10) / 10) + '%)';
    }

    function hslaCss(h, s, l, a) {
        return 'hsla(' + (Math.round(h * 10) / 10) + ', ' +
            (Math.round(clampN(s, 0, 100) * 10) / 10) + '%, ' +
            (Math.round(clampN(l, 0, 100) * 10) / 10) + '%, ' + a + ')';
    }

    /* 感知亮度：用于决定背景上的文字该用深色还是浅色 */
    function luma(hex) {
        var c = hexToRgb(hex);
        return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    }

    function contrastOn(hex) {
        return luma(hex) > 0.6 ? '#1f2329' : '#ffffff';
    }

    function mixHex(a, b, t) {
        var x = hexToRgb(a), y = hexToRgb(b);
        return rgbToHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
    }

    /* ---------------- 由一个主色派生整套主题 ---------------- */

    /* 派生规则（浅色）：
       背景走"主色相 + 很低饱和 + 很高明度"，于是整体是带一点色调的白，
       而不是死白；强调色本身保持饱和，用于菜单条、弹窗头、高亮。
       深色同理，只是明度压到 10%~25%。 */
    function deriveGui(accent, dark) {
        var a = hexToRgb(accent);
        var H = rgbToHsl(a.r, a.g, a.b);
        var h = H.h;
        var sRaw = H.s;
        /* 极低饱和的主色（灰）会派生出一片灰，稍微补一点饱和让主题有色感 */
        var S = clampN(sRaw < 12 ? 30 : sRaw, 22, 88);
        var g = {};

        if (dark) {
            var dS = clampN(S * 0.28, 8, 26);
            g['color-scheme'] = 'dark';
            g['ui-primary'] = hslCss(h, dS, 12);
            g['ui-secondary'] = hslCss(h, dS, 17);
            g['ui-tertiary'] = hslCss(h, dS + 4, 24);
            g['ui-modal-overlay'] = 'rgba(0, 0, 0, 0.62)';
            g['ui-modal-background'] = hslCss(h, dS, 13);
            g['ui-modal-foreground'] = hslCss(h, 12, 92);
            g['ui-modal-header-background'] = hslCss(h, S * 0.5, 26);
            g['ui-modal-header-foreground'] = '#ffffff';
            g['ui-white'] = hslCss(h, dS, 13);
            g['ui-white-dim'] = hslaCss(h, dS, 13, 0.75);
            g['ui-white-transparent'] = hslaCss(h, dS, 13, 0.25);
            g['ui-transparent'] = hslaCss(h, dS, 13, 0);
            g['ui-black-transparent'] = 'hsla(0, 0%, 100%, 0.16)';
            g['text-primary'] = hslCss(h, 12, 92);
            g['text-primary-transparent'] = hslaCss(h, 12, 92, 0.75);
            g['menu-bar-background'] = hslCss(h, S * 0.5, 22);
            g['assets-background'] = hslCss(h, dS, 12);
            g['input-background'] = hslCss(h, dS, 18);
            g['popover-background'] = hslCss(h, dS, 17);
            g['badge-background'] = hslCss(h, dS + 6, 20);
            g['badge-border'] = hslCss(h, dS + 10, 30);
            g['fullscreen-background'] = hslCss(h, dS, 12);
            g['fullscreen-accent'] = hslCss(h, dS, 12);
            g['page-background'] = hslCss(h, dS, 12);
            g['page-foreground'] = hslCss(h, 12, 92);
            g['project-title-inactive'] = 'var(--ui-secondary)';
            g['project-title-hover'] = '#ffffff3f';
            g['link-color'] = hslCss(h, clampN(S, 55, 90), 68);
            g['filter-icon-black'] = 'invert(100%)';
            g['filter-icon-gray'] = 'grayscale(100%) brightness(1.7)';
            g['filter-icon-white'] = 'brightness(0) invert(100%)';
            g['paint-filter-icon-gray'] = 'brightness(1.7)';
        } else {
            var lS = clampN(S * 0.42, 22, 62);
            var fg = hslCss(h, clampN(S * 0.5, 18, 55), 26);
            g['color-scheme'] = 'light';
            g['ui-primary'] = hslCss(h, lS, 96);
            g['ui-secondary'] = hslCss(h, lS, 92);
            g['ui-tertiary'] = hslCss(h, lS, 86);
            g['ui-modal-overlay'] = 'rgba(0, 0, 0, 0.32)';
            g['ui-modal-background'] = hslCss(h, lS, 98);
            g['ui-modal-foreground'] = fg;
            g['ui-modal-header-background'] = accent;
            g['ui-modal-header-foreground'] = contrastOn(accent);
            g['ui-white'] = hslCss(h, lS, 99);
            g['ui-white-dim'] = hslaCss(h, lS, 99, 0.75);
            g['ui-white-transparent'] = hslaCss(h, lS, 99, 0.25);
            g['ui-transparent'] = hslaCss(h, lS, 99, 0);
            g['ui-black-transparent'] = hslaCss(h, clampN(S * 0.4, 15, 45), 30, 0.15);
            g['text-primary'] = fg;
            g['text-primary-transparent'] = hslaCss(h, clampN(S * 0.5, 18, 55), 26, 0.75);
            g['menu-bar-background'] = accent;
            g['assets-background'] = hslCss(h, lS, 94);
            g['input-background'] = hslCss(h, lS, 93);
            g['popover-background'] = hslCss(h, lS, 96);
            g['badge-background'] = hslCss(h, lS, 90);
            g['badge-border'] = hslCss(h, lS + 8, 78);
            g['fullscreen-background'] = hslCss(h, lS, 96);
            g['fullscreen-accent'] = hslCss(h, lS, 96);
            g['page-background'] = hslCss(h, lS, 96);
            g['page-foreground'] = fg;
            g['project-title-inactive'] = 'var(--ui-secondary)';
            g['project-title-hover'] = '#0000003f';
            g['link-color'] = hslCss(h, clampN(S, 60, 92), 40);
            g['filter-icon-black'] = 'none';
            g['filter-icon-gray'] = 'none';
            g['filter-icon-white'] = 'brightness(0) invert(100%)';
            g['paint-filter-icon-gray'] = 'none';
        }
        return g;
    }

    /* 积木栏 / 工作区背景：有渐变时同样半透明，让渐变透出来 */
    function deriveWorkspaceWithGrad(accent, dark, grad) {
        var ws = deriveWorkspace(accent, dark);
        if (!grad) return ws;
        var stops = normalizeStops(grad.stops);
        if (!stops.length) return ws;
        var a = dark ? '0.86' : '0.84';
        var keys = ['editorTheme3-workspace-background', 'editorTheme3-toolbox-background',
            'editorTheme3-flyout-background'];
        for (var i = 0; i < keys.length; i++) {
            if (ws[keys[i]]) ws[keys[i]] = alphaize(ws[keys[i]], a);
        }
        return ws;
    }

    function deriveWorkspace(accent, dark) {
        var a = hexToRgb(accent);
        var H = rgbToHsl(a.r, a.g, a.b);
        var h = H.h;
        var S = clampN(H.s < 12 ? 30 : H.s, 22, 88);
        if (dark) {
            var dS = clampN(S * 0.3, 8, 26);
            return {
                'editorTheme3-workspace-background': hslCss(h, dS, 14),
                'editorTheme3-toolbox-background': hslCss(h, dS, 11),
                'editorTheme3-flyout-background': hslCss(h, dS, 11),
                'editorTheme3-toolbox-text': hslCss(h, 15, 90),
                'editorTheme3-flyout-text': hslCss(h, 15, 90),
                'editorTheme3-grid-color': hslCss(h, dS + 8, 26),
                'editorTheme3-scrollbar': hslCss(h, dS + 12, 36)
            };
        }
        var lS = clampN(S * 0.42, 22, 62);
        return {
            'editorTheme3-workspace-background': hslCss(h, lS, 99),
            'editorTheme3-toolbox-background': hslCss(h, lS, 95),
            'editorTheme3-flyout-background': hslCss(h, lS, 96),
            'editorTheme3-toolbox-text': hslCss(h, clampN(S * 0.5, 18, 55), 26),
            'editorTheme3-flyout-text': hslCss(h, clampN(S * 0.5, 18, 55), 26),
            'editorTheme3-grid-color': hslCss(h, lS, 86),
            'editorTheme3-scrollbar': hslCss(h, lS + 6, 78)
        };
    }

    /* 注册一个派生主题。builtin=true 表示预设，不写进自定义存储 */
    function registerTheme(id, label, accent, dark, swatch, opts) {
        opts = opts || {};
        /* 有渐变时用渐变平均色派生，色相才跟画面一致（而不是只取第一个色标） */
        var base = accent;
        var grad = opts.grad || null;
        if (grad && grad.stops && grad.stops.length) {
            var avg = gradAverage(grad.stops);
            /* 平均色若接近无彩色（多色相混出来发灰），仍用主色标保住色感 */
            var ah = rgbToHsl(hexToRgb(avg).r, hexToRgb(avg).g, hexToRgb(avg).b);
            base = ah.s < 8 ? accent : avg;
        }
        var gui = deriveGui(base, dark);
        gui = applyGradLayer(gui, grad, dark);
        THEMES[id] = {
            label: label,
            swatch: swatch || accent,
            rgb: rgbToHexStr(gui['ui-primary']),
            blocksId: dark ? 'dark' : 'three',
            category: null,
            dark: !!dark,
            gui: gui,
            accent: accent,
            custom: !opts.builtin,
            group: opts.group || 'custom',
            grad: grad
        };
        WORKSPACE[id] = deriveWorkspaceWithGrad(base, dark, grad);
        if (ORDER.indexOf(id) < 0) ORDER.push(id);
        return THEMES[id];
    }

    /* ui-primary 可能是 hsl() 字符串也可能已是 hex，统一取 rgb 三元组文本 */
    function rgbToHexStr(v) {
        var s = String(v || '');
        if (s.charAt(0) === '#') {
            var c = hexToRgb(s);
            return c.r + ', ' + c.g + ', ' + c.b;
        }
        var m = s.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
        if (m) {
            var c2 = hslToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
            return Math.round(c2.r) + ', ' + Math.round(c2.g) + ', ' + Math.round(c2.b);
        }
        return '229, 240, 255';
    }

    /* ---------------- 预设色板（分好类） ---------------- */

    var PRESETS = [
        {
            id: 'basic', label: '基础', items: [
                { id: 'light', label: '亮色', accent: '#4c97ff', dark: false, swatch: '#dfeaf9', builtin: true },
                { id: 'dark', label: '暗色', accent: '#4c97ff', dark: true, swatch: '#1f2329', builtin: true }
            ]
        },
        {
            id: 'soft', label: '柔和', items: [
                { id: 'sakura', label: '樱花', accent: '#e78aae', dark: false, swatch: '#f6c3d8', builtin: true },
                { id: 'lavender', label: '薰衣草', accent: '#9b8cf0', dark: false, swatch: '#d8d2fb' },
                { id: 'mint', label: '薄荷', accent: '#3ec9b0', dark: false, swatch: '#c8f2ea' },
                { id: 'peach', label: '蜜桃', accent: '#ff9a6c', dark: false, swatch: '#ffdfcd' },
                { id: 'cream', label: '奶油', accent: '#d9a05b', dark: false, swatch: '#f7e6cd' }
            ]
        },
        {
            id: 'nature', label: '自然', items: [
                { id: 'forest', label: '森林', accent: '#3f9e5a', dark: false, swatch: '#cdeed6' },
                { id: 'ocean', label: '海洋', accent: '#2b9fd4', dark: false, swatch: '#c9e8f7' },
                { id: 'sunset', label: '日落', accent: '#ff6b6b', dark: false, swatch: '#ffd5d5' },
                { id: 'aurora', label: '极光', accent: '#37c8a4', dark: false, swatch: '#c6f2e6' },
                { id: 'desert', label: '沙漠', accent: '#c98a3c', dark: false, swatch: '#f2e0c4' }
            ]
        },
        {
            id: 'deep', label: '深邃', items: [
                { id: 'deepsea', label: '深海', accent: '#2b7fd4', dark: true, swatch: '#0a1b2c', builtin: true },
                { id: 'midnight', label: '午夜', accent: '#6b7fd7', dark: true, swatch: '#141a2e' },
                { id: 'graphite', label: '石墨', accent: '#8b95a5', dark: true, swatch: '#1c1f24' },
                { id: 'obsidian', label: '曜石', accent: '#a86bd6', dark: true, swatch: '#171021' },
                { id: 'ember', label: '余烬', accent: '#e0563f', dark: true, swatch: '#231310' }
            ]
        }
    ];

    /* [B108] 新增主题色：用户点名的 16 色。已有的「极光」直接复用，
       其余 15 个以独立 id 注册，避免与既有分组重名。 */
    PRESETS.push({
        id: 'more', label: '更多', items: [
            { id: 'glacier',      label: '冰川',        accent: '#6fc4e8', dark: false, swatch: '#dff2fb' },
            { id: 'hatsune',      label: '初音蓝',      accent: '#2fbfb4', dark: false, swatch: '#d0f3f0' },
            { id: 'tianyi',       label: '天依蓝',      accent: '#59b9ff', dark: false, swatch: '#d9edff' },
            { id: 'dawnwhite',    label: '晨白',        accent: '#cfd9e8', dark: false, swatch: '#f3f7fc' },
            { id: 'peachpink',    label: '桃粉',        accent: '#ff96b0', dark: false, swatch: '#ffe1e9' },
            { id: 'chinared',     label: '中国红',      accent: '#d42a2a', dark: false, swatch: '#f8d8d8' },
            { id: 'freshgreen',   label: '清新绿',      accent: '#48cb68', dark: false, swatch: '#daf5e1' },
            { id: 'skyblue',      label: '天空蓝',      accent: '#4aa6e0', dark: false, swatch: '#d8ecfb' },
            { id: 'blazesun',     label: '烈阳',        accent: '#ff8a1f', dark: false, swatch: '#ffe7c9' },
            { id: 'deeppurple',   label: '幽紫',        accent: '#7b57d6', dark: false, swatch: '#e6dcfa' },
            { id: 'scratchblue',  label: 'scratch蓝',   accent: '#4c97ff', dark: false, swatch: '#dbe8ff' },
            { id: 'scratchpurple',label: 'scratch紫',   accent: '#855cd6', dark: false, swatch: '#e8ddfb' },
            { id: 'twred',        label: 'TurboWarp红', accent: '#f04848', dark: false, swatch: '#ffdede' },
            { id: 'sunset2',      label: '落日',        accent: '#ff7846', dark: false, swatch: '#ffe0d2' },
            { id: 'afterglow',    label: '余晖',        accent: '#d9773b', dark: false, swatch: '#f6e1cf' }
        ]
    });

    /* 渐变编辑器里的快速预设 */
    var GRAD_PRESETS = [
        { label: '日落', stops: ['#ffd166', '#ff8c42', '#ff6b6b'] },
        { label: '海洋', stops: ['#a8e6ff', '#4aa8e0', '#1f6fb2'] },
        { label: '森林', stops: ['#c8f0c0', '#5cb85c', '#2f7a3f'] },
        { label: '紫雨', stops: ['#e3d1ff', '#a86bd6', '#5b2c8c'] }
    ];

    function initPresets() {
        for (var i = 0; i < PRESETS.length; i++) {
            var grp = PRESETS[i];
            for (var k = 0; k < grp.items.length; k++) {
                var it = grp.items[k];
                /* light/dark/sakura/deepsea 是手写的精细主题，不覆盖 */
                if (it.builtin && THEMES[it.id]) {
                    THEMES[it.id].group = grp.id;
                    THEMES[it.id].accent = it.accent;
                    if (ORDER.indexOf(it.id) < 0) ORDER.push(it.id);
                    continue;
                }
                registerTheme(it.id, it.label, it.accent, it.dark, it.swatch,
                    { builtin: true, group: grp.id });
            }
        }
    }

    /* ---------------- 自定义主题的持久化 ---------------- */

    function readCustom() {
        try {
            var raw = window.localStorage.getItem(CUSTOM_STORE);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }

    function writeCustom(arr) {
        try { window.localStorage.setItem(CUSTOM_STORE, JSON.stringify(arr)); } catch (e) { /* ignore */ }
    }

    function loadCustomThemes() {
        var arr = readCustom();
        var group = { id: 'custom', label: '我的主题', items: [] };
        for (var i = 0; i < arr.length; i++) {
            var t = arr[i];
            if (!t || !t.id || !t.accent) continue;
            /* swatch 旧数据可能是纯色 hex，新数据是渐变 CSS —— 都交给 swatchStyle 判断 */
            registerTheme(t.id, t.label || '自定义', t.accent, !!t.dark, t.swatch || t.accent,
                { builtin: false, group: 'custom', grad: t.grad || null });
            group.items.push({
                id: t.id, label: t.label || '自定义', accent: t.accent,
                dark: !!t.dark, swatch: t.swatch || t.accent, grad: t.grad || null,
                desc: t.desc || ''
            });
        }
/* 保证"我的主题"分组始终存在，方便 UI 统一渲染 */
        var found = false;
        for (var k = 0; k < PRESETS.length; k++) {
            if (PRESETS[k].id === 'custom') { PRESETS[k] = group; found = true; break; }
        }
        if (!found) PRESETS.push(group);
    }

    function saveCustomTheme(id, label, desc, accent, dark, swatch, grad) {
        var arr = readCustom();
        var rec = { id: id, label: label, desc: desc || '', accent: accent, dark: !!dark, swatch: swatch || accent, grad: grad || null };
        var hit = false;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id === id) { arr[i] = rec; hit = true; break; }
        }
        if (!hit) arr.push(rec);
        writeCustom(arr);
        registerTheme(id, label, accent, !!dark, swatch || accent, { builtin: false, group: 'custom', grad: grad || null });
        /* 同步进"我的主题"分组 */
        for (var k = 0; k < PRESETS.length; k++) {
            if (PRESETS[k].id !== 'custom') continue;
            var items = PRESETS[k].items, got = false;
            for (var m = 0; m < items.length; m++) {
                if (items[m].id === id) { items[m] = rec; got = true; break; }
            }
            if (!got) items.push(rec);
            break;
        }
        return rec;
    }

    function removeCustomTheme(id) {
        var arr = readCustom(), out = [];
        for (var i = 0; i < arr.length; i++) if (arr[i].id !== id) out.push(arr[i]);
        writeCustom(out);
        try { delete THEMES[id]; delete WORKSPACE[id]; } catch (e) { /* ignore */ }
        var oi = ORDER.indexOf(id);
        if (oi >= 0) ORDER.splice(oi, 1);
        for (var k = 0; k < PRESETS.length; k++) {
            if (PRESETS[k].id !== 'custom') continue;
            var items = [], src = PRESETS[k].items;
            for (var m = 0; m < src.length; m++) if (src[m].id !== id) items.push(src[m]);
            PRESETS[k].items = items;
            break;
        }
    }

    var ORDER = ['light', 'dark', 'deepsea', 'sakura'];

    var LABEL_COLORS = {
        light: '#33506f', dark: '#f2f4f7', deepsea: '#e0eefb', sakura: '#7d4157'
    };

    var BLOCK_CATEGORIES = [
        'motion', 'looks', 'sounds', 'control', 'event', 'sensing',
        'pen', 'operators', 'strings', 'data', 'data_lists', 'more', 'addons', 'assets'
    ];

    /* 工具箱分类 id（DOM 上的 scratchCategoryId-*）→ 配色表里的键 */
    var CATEGORY_ID_MAP = {
        motion: 'motion',
        looks: 'looks',
        sound: 'sounds', sounds: 'sounds',
        events: 'event', event: 'event',
        control: 'control',
        sensing: 'sensing',
        operators: 'operators',
        mwStrings: 'strings', strings: 'strings',
        variables: 'data', data: 'data',
        lists: 'data_lists', dataLists: 'data_lists', data_lists: 'data_lists', 'data-lists': 'data_lists',
        myBlocks: 'more', more: 'more',
        pen: 'pen',
        addons: 'addons',
        assets: 'assets'
    };

    /* 积木输入槽（数字框 / 下拉菜单 / 文本输入）的配色。
       这些槽本质是 shadow 积木，底色取自 Blockly.Colours.textField。
       积木配色被锁定为亮色主题后 textField 恒为白色，
       于是深色界面上会出现一片白框 —— 这里按界面主题单独指定。 */
    var FIELD_COLORS = {
        light:   { bg: '#ffffff', border: '#c8ccd4', text: '#575e75' },
        sakura:  { bg: '#fff6f9', border: '#e7bccb', text: '#6d3149' },
        dark:    { bg: '#2b2f36', border: '#5c6270', text: '#eeeeee' },
        deepsea: { bg: '#12283d', border: '#35618a', text: '#dbeaf7' }
    };

    function fieldColors() {
        return FIELD_COLORS[currentTheme] || FIELD_COLORS.light;
    }

    var currentTheme = 'light';
    var currentBlocks = 'three';
    var lastFolder = 'default';
    var lastEditorTheme = null;    /* 上一次从 redux 读到的主题指纹 */
    var lastAppliedColors = null;  /* 最近一次生效的合并配色，重建后据此补色 */
    var pendingRepaintDuringLoad = false;  /* 作品加载期间攒一次，加载完统一补 */
    var recolorSeq = 0;            /* 重涂排队 token */
    var pendingApply = 0;          /* Blockly 未就绪时的重试计时器 */
    /* 界面配色是否由我们的轮盘接管。
       若用户是在编辑器「设置」里改的主题，这里会置为 false，
       我们只对齐积木区，不再回写 CSS 变量，避免把编辑器的主题冲掉。 */
    var myGuiActive = true;

    /* 当前明暗：轮盘接管时用轮盘的值，否则以编辑器 redux 为准 */
    function isDarkNow() {
        if (myGuiActive) {
            var t = THEMES[currentTheme];
            return !!(t && t.dark);
        }
        return editorIsDark();
    }

    /* 以编辑器 redux 里的 gui 为准判断明暗。
       这样即使用户是在「设置」里改的主题，积木区也能跟着变。 */
    function editorIsDark() {
        var store = window.ReduxStore;
        if (store && typeof store.getState === 'function') {
            try {
                var st = store.getState();
                var th = st && st.scratchGui && st.scratchGui.theme && st.scratchGui.theme.theme;
                if (th && th.gui) {
                    if (th.gui === 'dark' || th.gui === 'midnight') return true;
                    if (th.gui === 'light') return false;
                }
            } catch (e) { /* ignore */ }
        }
        var t = THEMES[currentTheme];
        return !!(t && t.dark);
    }

    /* 编辑器当前主题指纹：gui + blocks */
    function editorThemeKey() {
        var store = window.ReduxStore;
        if (!store || typeof store.getState !== 'function') return null;
        try {
            var st = store.getState();
            var th = st && st.scratchGui && st.scratchGui.theme && st.scratchGui.theme.theme;
            if (!th) return null;
            return String(th.gui) + '|' + String(th.blocks);
        } catch (e) {
            return null;
        }
    }

    /* 决定积木区配色：
       始终跟随界面主题：亮色系取 three、暗色系取 dark；樱花/深海额外套专属分类色 */
    /* 积木配色锁定为亮色主题（three）：界面主题只影响界面，不再影响积木 */
    function resolveBlocksTarget() {
        return 'three';
    }

    /* 统一入口：任何主题变化都走这里重新对齐积木区 */
    function syncBlocks(animate) {
        var t = resolveBlocksTarget();
        return applyBlockTheme(resolveBlocksTarget(), animate === true);
    }

    /* 编辑器自行改主题（设置面板 / 快捷键 / addon）时补一次对齐 */
    function watchEditorTheme() {
        var store = window.ReduxStore;
        if (!store || typeof store.subscribe !== 'function') return false;
        lastEditorTheme = editorThemeKey();
        store.subscribe(function () {
            var key = editorThemeKey();
            if (key === lastEditorTheme) return;
            lastEditorTheme = key;
            /* 是我们自己同步过去的（syncEditorReduxTheme），不是用户在编辑器里改的：
               不能交出控制权，否则自定义主题会被编辑器的明暗基线冲掉。
               用时间窗而不是计数器：dispatch 若因异常没走到订阅，也不会留下死锁。 */
            if (Date.now() < selfThemeSyncUntil) return;
            /* 编辑器自己的主题变了：交出界面配色控制权，只对齐积木区 */
            myGuiActive = false;
            /* 记录对齐到编辑器当前的明暗，避免下次启动又判定为不一致 */
            currentTheme = editorIsDark() ? 'dark' : 'light';
            writeStore(STORE_THEME, currentTheme);
            markActive(currentTheme);
            syncBlocks(false);
        });
        return true;
    }

    /* ================================================================== *
     * 外观类设置：启动时补一遍
     *
     * 原生把这些设置做成"写 localStorage + 注入一条 <style>"，
     * 但那个"启动时把全部设置应用一遍"的导出函数从未被调用过，
     * 于是只有手动拨开关的一瞬间生效，刷新之后全部丢失 ——
     * 「方角舞台」就是这样失效的。
     *
     * 另外原生的 square-stage-corners 选择器写的是 [class*="stage_section"]，
     * 而这个类名在当前版本里根本不存在（build.py 里已把选择器改对），
     * 这里再补一份等价的，双保险。
     * ================================================================== */

    var APPEARANCE = [
        {
            id: 'square-stage-corners', def: false,
            css: '[class*="stage_stage_"],[class*="stage-wrapper"],' +
                 '[class*="stage_green-flag-overlay-wrapper"]{border-radius:0 !important;}'
        },
        {
            id: 'hide-delete-button', def: false,
            css: '[data-tabs] > :nth-child(3) div[class*="delete-button_delete-button_"],' +
                 '[data-tabs] > :nth-child(4) div[class*="delete-button_delete-button_"],' +
                 'div[class*="sprite-selector_sprite-wrapper_"] div[class*="delete-button_delete-button_"]' +
                 '{display:none;}'
        },
        {
            id: 'hide-extension-button', def: false,
            css: '[class*="extension-button-container"]{display:none !important;}'
        },
        {
            id: 'unclip-palette', def: true,
            css: '.injectionDiv:has(> .blocklyToolboxDiv:hover, > svg.blocklyFlyout:not(.sa-flyoutClose):hover)' +
                 ' > svg.blocklyFlyout:not(.sa-flyoutClose){overflow:visible;}' +
                 '.injectionDiv:has(> .blocklyToolboxDiv:hover, > svg.blocklyFlyout:not(.sa-flyoutClose):hover)' +
                 ' #blocklyBlockMenuClipRect{width:100000px;}'
        }
        /* hide-backpack 不在这里：背包已由积木栏 DOCK 的「书包」按钮统一开关 */
    ];

    function apRead(id, def) {
        try {
            var v = window.localStorage.getItem('mw:' + id);
            if (v === null) return !!def;
            return v === 'true';
        } catch (e) {
            return !!def;
        }
    }

    function applyAppearance() {
        for (var i = 0; i < APPEARANCE.length; i++) {
            var a = APPEARANCE[i];
            var el = document.getElementById('bl-appearance-' + a.id);
            if (apRead(a.id, a.def)) {
                if (el) continue;
                var st = document.createElement('style');
                st.id = 'bl-appearance-' + a.id;
                st.textContent = a.css;
                document.head.appendChild(st);
            } else if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
    }

    /* 设置面板里改动后立刻生效：既监听本页面的 storage 事件，
       也在设置面板关闭时补跑一次（同一个标签页内 storage 事件不会派发给自己） */
    function watchAppearance() {
        window.addEventListener('storage', function (e) {
            if (e && String(e.key || '').indexOf('mw:') === 0) applyAppearance();
        });
        if (!document.__blApWatch) {
            document.__blApWatch = true;
            var t = window.setInterval(function () {
                /* 设置面板开着时，用户每拨一次开关都重新对齐一次。
                   面板本身是懒渲染的，用 MutationObserver 不如这样稳。 */
                if (document.querySelector('[class*="settings-modal"]') ||
                    document.querySelector('[class*="modal-overlay"]')) {
                    applyAppearance();
                }
            }, 900);
        }
    }

    /* ================================================================== *
     * 舞台大小切换的过渡动画
     *
     * 编辑器刻意不给 .stage_stage_* 加 width/height 过渡：源码注释写明
     * "拖拽调尺寸时会有 0.3s 延迟，手感发黏"。
     * 所以过渡只能临时挂 —— 检测到 stageSize 变化（来自按钮）才加类，
     * 动画结束立刻摘掉；拖动调尺寸走的是另一条通路，完全不受影响。
     * ================================================================== */

    var stageAnimTimer = 0;
    var lastStageSize = null;

    function stageSizeKey() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var v = st && st.scratchGui && st.scratchGui.stageSize &&
                st.scratchGui.stageSize.stageSize;
            return v == null ? '' : String(v);
        } catch (e) {
            return '';
        }
    }

    function beginStageAnim() {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var root = document.documentElement;
        root.classList.add('bl-stage-anim');
        window.clearTimeout(stageAnimTimer);
        /* 略长于 CSS 的 0.28s，确保动画跑完再摘，避免半路被截断 */
        stageAnimTimer = window.setTimeout(function () {
            root.classList.remove('bl-stage-anim');
        }, 420);
    }

    function watchStageSize() {
        var store = window.ReduxStore;
        if (!store || typeof store.subscribe !== 'function') return false;
        lastStageSize = stageSizeKey();
        store.subscribe(function () {
            var key = stageSizeKey();
            if (key === lastStageSize) return;
            lastStageSize = key;
            beginStageAnim();
        });
        return true;
    }

    /* ================================================================== *
     * 界面主题
     * ================================================================== */

    function guiVars(name) {
        var theme = THEMES[name] || THEMES.light;
        var out = Object.create(null);
        var key;
        /* 先铺满亮色基线（内部记忆避免重复写） */
        for (key in BASE) {
            if (Object.prototype.hasOwnProperty.call(BASE, key)) out[key] = BASE[key];
        }
        for (key in theme.gui) {
            if (Object.prototype.hasOwnProperty.call(theme.gui, key)) out[key] = theme.gui[key];
        }
        out['ui-primary-rgb'] = theme.rgb;
        /* 渐变主题：铺背景层 + 把大面积背景改成半透明 */
        if (theme.grad) applyGradLayer(out, theme.grad, !!theme.dark);
        return out;
    }

    /* 积木栏（工具箱 / 抽屉）背景跟随界面主题，所以其中的文字要按当前明暗取色，
       否则深色背景下会出现深色文字看不见的问题。
       注意：只有文字跟随，分类圆点与积木本身仍固定为亮色主题配色。 */
    function toolboxTextColor() {
        var ws = WORKSPACE[currentTheme] || WORKSPACE.light;
        return ws['editorTheme3-toolbox-text'] || '#575e75';
    }

    function flyoutTextColor() {
        var ws = WORKSPACE[currentTheme] || WORKSPACE.light;
        return ws['editorTheme3-flyout-text'] ||
            ws['editorTheme3-toolbox-text'] || '#575e75';
    }

    /* 把明暗同步写进编辑器自己的 tw:theme。
       只在我们自己的轮盘切换时写（applyGuiOnly / mw:theme-applied 不写），
       避免与编辑器互相触发形成循环。写 'dark' / 'light' 两个字面值即可，
       编辑器启动时会据此还原明暗。 */
    function writeEditorTheme(name) {
        var t = THEMES[name] || THEMES.light;
        try {
            window.localStorage.setItem('tw:theme', t.dark ? 'dark' : 'light');
        } catch (e) { /* ignore */ }
    }

    /* 把明暗同步进编辑器的 redux。
       只写 localStorage 是不够的：redux 里的 theme.gui 仍停在旧值，
       于是"界面是亮的、编辑器自己却以为是暗的"。一旦有代码按 redux 重新应用主题
       （改插件设置、切积木配色都会 dispatch scratch-gui/theme/SET_THEME），
       整片界面会被拉回旧的明暗 —— 表现为"明明改成亮色了，很多东西还是暗色主题"。
       这里主动 dispatch 一次，让两边的认知一致。 */
    var selfThemeSyncUntil = 0;

    function syncEditorReduxTheme(name) {
        var store = window.ReduxStore;
        if (!store || typeof store.dispatch !== 'function') return false;
        try {
            var st = store.getState();
            var th = st && st.scratchGui && st.scratchGui.theme && st.scratchGui.theme.theme;
            if (!th || typeof th.set !== 'function') return false;
            var t = THEMES[name] || THEMES.light;
            var target = t.dark ? 'dark' : 'light';
            if (String(th.gui) === target) return false;
            var next = th.set('gui', target);
            if (!next) return false;
            selfThemeSyncUntil = Date.now() + 2000;
            store.dispatch({ type: 'scratch-gui/theme/SET_THEME', theme: next });
            return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    /* dispatch 之后编辑器会按 redux 重铺一遍自己的配色，可能盖掉我们的变量。
       它的应用时机不保证同步，所以连着补几次，确保最终是我们这套。 */
    function reassertGui() {
        resetVarCache();
        applyGuiOnly();
        /* 原来 4 次延时重断言（0 / 16 / 120 / 420ms）在亮↔暗切换时
           把同一批 CSS 变量 + 工作区表面刷 5 遍，正是卡顿主因之一。
           收敛为「下一帧一次 + 180ms 兜底一次」，签名短路照旧。 */
        /* [B109] 第一次放到下一帧（dispatch 后的 React 重绘结束），
           第二次挪出 360ms 过渡窗口。旧版 0ms 那次紧跟 dispatch，
           与 React 重绘 + 颜色动画挤在一起，是亮↔暗掉帧主因之一。 */
        var delays = ['raf', TRANSITION_MS + 20];
        for (var i = 0; i < delays.length; i++) {
            (function (d) {
                var fn = function () { resetVarCache(); applyGuiOnly(); };
                if (d === 'raf') {
                    try { window.requestAnimationFrame(fn); }
                    catch (eRaf) { window.setTimeout(fn, 16); }
                } else window.setTimeout(fn, d);
            })(delays[i]);
        }
    }

    /* [B109] 过渡窗口合并：applyTheme(360ms) 与积木重涂(300ms) 会先后
       调用本函数，旧版各排一个 timer，先到期的那个会提前摘掉 class，
       动画因此「有时太快」。现在只维护一个到期时刻 + 一个 timer。 */
    var TRANSITION_MS = 360;
    var transUntil = 0, transTimer = 0, themeApplyGen = 0;
    function beginTransition(ms) {
        var root = document.documentElement;
        var d = ms > 0 ? ms : TRANSITION_MS;
        var until = Date.now() + d;
        if (until > transUntil) transUntil = until;
        if (!root.classList.contains(TRANSITION_CLASS)) root.classList.add(TRANSITION_CLASS);
        if (transTimer) return;
        var check = function () {
            var left = transUntil - Date.now();
            if (left > 0) { transTimer = window.setTimeout(check, left + 8); return; }
            transTimer = 0;
            root.classList.remove(TRANSITION_CLASS);
        };
        transTimer = window.setTimeout(check, d + 8);
    }

    /* 渐变主题要在 <html> 上挂开关类：
       渐变图元必须画在【真正盖住视口】的那几层上（body / interface_container）。
       之前只画在 html 上，而 body 与 .interface_container_2nBns 各自又铺了一层
       page-background —— 三层半透明叠乘后渐变只剩约 8%，肉眼就是纯色。 */
    var gradOn = false;
    function syncGradClass() {
        var root = document.documentElement;
        var t = THEMES[currentTheme];
        var on = !!(t && t.grad && t.grad.stops && t.grad.stops.length);
        /* [B109] 状态短路：hover 扫球时每次都 add/remove 会让渐变层
           反复失效重绘；状态没变就一个 DOM 操作都不做。 */
        if (on === gradOn && root.classList.contains('bl-grad-on') === on) return;
        gradOn = on;
        if (on) root.classList.add('bl-grad-on');
        else root.classList.remove('bl-grad-on');
    }

    function applyTheme(name, animate, fromUser) {
        if (!THEMES[name]) name = 'light';
        /* [B109] 确认主题即作废旧 hover 预览，避免下一帧的预览 rAF
           把刚确认的配色写回去。 */
        try { cancelPreview(); } catch (eCp) { /* ignore */ }
        themeApplyGen = (themeApplyGen || 0) + 1;
        currentTheme = name;
        /* 只有用户点了我们的轮盘才夺回界面配色控制权 */
        if (fromUser) myGuiActive = true;
        resetVarCache();
        if (animate !== false) beginTransition(TRANSITION_MS);   /* 明暗切换看得清 */
        applyGuiOnly();
        syncGradClass();
        writeStore(STORE_THEME, name);
        writeEditorTheme(name);
        /* 毛玻璃菜单那张补充表按 --color-scheme 取色，原本靠 150ms 轮询兜底。
           主题切换这一刻主动刷一次，右键菜单不再「慢半拍」。 */
        try { if (typeof window.__blGlassSync === 'function') window.__blGlassSync(); }
        catch (eGlass) { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('bl:theme-changed', { detail: { name: name } })); }
        catch (eEvt) { /* ignore */ }
        markActive(name);
        syncPackagerTheme();
        /* 同步给 redux，并补一次断言（dispatch 会让编辑器重铺它自己的配色） */
        try {
            if (syncEditorReduxTheme(name)) reassertGui();
        } catch (e) { /* ignore */ }

        /* 积木区配色跟随界面主题：CSS 变量已即时生效，逐块 updateColour
           不再卡在当前事件里同步跑完（亮↔暗切换 1300+ 块时主线程会锁死），
           改为双 rAF 后执行一次；连续切换只跑最后一次。 */
        try { scheduleThemeRepaint(); } catch (e) { /* ignore */ }
    }

    /* [B109] 主题重涂调度：
       积木目标配色恒定（resolveBlocksTarget 恒返回 three），界面明暗
       切换时积木四色根本没变。旧版每次切换都 syncBlocks() 逐块
       updateColour() 全量重涂 1300+ 块、再排两轮补涂，全部落在
       360ms 动画窗口里抢帧 —— 这就是亮↔暗「卡一下」的主因。
       现在只在目标真的变化时重涂，且延到动画窗口结束后；
       否则只刷新「跟随界面明暗」的表面部分。 */
    var themeRepaintGen = 0, themeRepaintQueued = false;
    var previewVarsCache = Object.create(null);
    var previewRaf = 0, previewPending = null;

    function cancelPreview() {
        previewPending = null;
        if (previewRaf) {
            try { window.cancelAnimationFrame(previewRaf); } catch (e) { /* ignore */ }
            previewRaf = 0;
        }
    }
    function previewVars(id) {
        var v = previewVarsCache[id];
        if (!v) {
            v = previewVarsCache[id] = {
                gui: guiVars(id),
                ws: WORKSPACE[id] || WORKSPACE.light
            };
        }
        return v;
    }
    function doPreview(id) {
        var v = previewVars(id);
        var saved = currentTheme;
        currentTheme = id;
        try {
            flushVars(v.gui);
            flushVars(v.ws);
            syncGradClass();
        } catch (e) { /* ignore */ }
        currentTheme = saved;
    }
    function refreshThemeSurfaces() {
        /* 工作区 / 工具箱 / 抽屉表面与输入槽文字：跟着界面明暗走，
           不动积木四色、不重建样式表、不启动补涂定时器。 */
        try {
            flushVars(WORKSPACE[currentTheme] || WORKSPACE.light);
            paintWorkspaceSurfaces();
        } catch (e1) { /* ignore */ }
        try {
            var fh = flyoutTextColor();
            each('.blocklyFlyoutLabelText', function (el) {
                el.style.setProperty('fill', fh, 'important');
            });
        } catch (e2) { /* ignore */ }
        try {
            var SB = window.ScratchBlocks || window.Blockly;
            if (SB) applyFieldColors(SB);
        } catch (e3) { /* ignore */ }
    }
    function scheduleThemeRepaint() {
        if (themeRepaintQueued) return;
        themeRepaintQueued = true;
        /* [B109] 代号必须在「已排队」判断之后递增：旧版先 ++ 再 return，
           连续切两次时第二次会作废唯一排队的 run，重涂/刷新一次都不跑。 */
        var g = ++themeRepaintGen;
        var run = function () {
            themeRepaintQueued = false;
            if (g !== themeRepaintGen) return;
            if (window.__blProjectLoading) return;
            try {
                if (resolveBlocksTarget() !== currentBlocks) {
                    /* 目标真变了：放到过渡窗口结束后再全量重涂 */
                    window.setTimeout(function () {
                        if (g !== themeRepaintGen) return;
                        try { syncBlocks(false); } catch (eH) { /* ignore */ }
                    }, TRANSITION_MS - 24);
                } else {
                    refreshThemeSurfaces();
                }
            } catch (e) { /* ignore */ }
        };
        try {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(run);
            });
        } catch (e2) { window.setTimeout(run, 32); }
    }

    /* [B108] 供 hover 预览 / 单击确认 / 顶部补丁使用的轻量控制口 */
    window.__blThemeCtl = {
        current: function () { return currentTheme; },
        apply: function (id) { applyTheme(id, true, true); },
        /* 只写变量与渐变开关，不写存档、不动 redux、不重涂积木 */
        preview: function (id) {
            if (!THEMES[id]) return;
            /* [B109] 同帧合并 + 变量缓存：扫过一排球只写最后一帧，
               guiVars 也不再每次重算；期间若已确认主题则整批作废。 */
            previewPending = id;
            if (previewRaf) return;
            var g = themeApplyGen;
            try {
                previewRaf = window.requestAnimationFrame(function () {
                    previewRaf = 0;
                    var pid = previewPending;
                    previewPending = null;
                    if (!pid || g !== themeApplyGen) return;
                    try { doPreview(pid); } catch (eP) { /* ignore */ }
                });
            } catch (eR) {
                previewRaf = 0;
                var pid2 = previewPending; previewPending = null;
                if (pid2) { try { doPreview(pid2); } catch (eP2) {} }
            }
        },
        open: function () { openPanel(); },
        close: function () { closePanel(); }
    };

    /* 只重新断言界面变量（便宜，可反复调用，用于修复编辑器自行重绘主题） */
    function applyGuiOnly() {
        /* 界面 CSS 变量：只在轮盘接管时写，避免把编辑器自己的主题冲掉 */
        if (myGuiActive) flushVars(guiVars(currentTheme));
        syncGradClass();
        /* 积木栏 / 工作区底色：用户要求跟随主题，不受控制权影响 */
        flushVars(WORKSPACE[currentTheme] || WORKSPACE.light);
        paintWorkspaceSurfaces();
    }

    /* ================================================================== *
     * 积木区配色（跟随界面主题，不再单独设置）
     * ================================================================== */

    function getBlockColorsFor(id) {
        var store = window.ReduxStore;
        var SB = window.ScratchBlocks;
        if (!store || typeof store.getState !== 'function') {
            /* redux 不可用时的兜底：以 Blockly 当前配色表为基色 */
            if (SB && SB.Colours && typeof SB.Colours === 'object') {
                return SB.Colours;
            }
            return null;
        }
        var state = store.getState();
        var theme = state && state.scratchGui && state.scratchGui.theme && state.scratchGui.theme.theme;
        if (!theme || typeof theme.set !== 'function') return null;
        var next;
        try {
            next = theme.set('blocks', id);
        } catch (e) {
            return null;
        }
        if (!next || typeof next.getBlockColors !== 'function') return null;
        var colors = next.getBlockColors();
        if (!colors || typeof colors !== 'object') return null;
        return colors;
    }

    function blockVars(colors) {
        var out = Object.create(null);
        var i, cat, c;
        if (colors.text) out['editorTheme3-blockText'] = colors.text;
        if (colors.textField) out['editorTheme3-inputColor'] = colors.textField;
        if (colors.textFieldText) out['editorTheme3-inputColor-text'] = colors.textFieldText;
        for (i = 0; i < BLOCK_CATEGORIES.length; i++) {
            cat = BLOCK_CATEGORIES[i];
            c = colors[cat];
            if (!c) continue;
            if (c.primary) out['editorTheme3-' + cat + '-primary'] = c.primary;
            if (c.secondary) out['editorTheme3-' + cat + '-secondary'] = c.secondary;
            if (c.tertiary) out['editorTheme3-' + cat + '-tertiary'] = c.tertiary;
            if (c.quaternary) out['editorTheme3-' + cat + '-field-background'] = c.quaternary;
        }
        if (colors.scrollbar) out['editorTheme3-scrollbar'] = colors.scrollbar;
        if (colors.gridColor) out['editorTheme3-grid-color'] = colors.gridColor;
        return out;
    }

    function applyBlockTheme(id, animate) {
        try {
            return applyBlockThemeInner(id, animate);
        } catch (e) {
            /* 上色失败绝不能影响编辑器运行，也不该刷成"运行错误" */
            return false;
        }
    }

    function applyBlockThemeInner(id, animate) {
        var SB = window.ScratchBlocks || window.Blockly;
        if (!SB || !SB.Colours) {
            /* Blockly 尚未加载：排队重试。
               之前这里直接 return false 且不再重试，是"切换后完全不变"的主因 */
            retryApply();
            return false;
        }

        /* 积木配色已锁定为亮色主题（resolveBlocksTarget 恒返回 three），
           所以 blocks-media 目录只有 default 一种：
           之前这里读的 BLOCK_FOLDERS 在删除积木主题设置时被一起清掉了，
           留着引用会抛 ReferenceError，导致整个上色流程中断。 */
        var folder = 'default';
        var i;

        var colors = getBlockColorsFor(id);
        if (!colors) return false;
        currentBlocks = id;

        if (animate !== false) beginTransition(300);

        /* 1) 一次写入积木配色变量 */
        flushVars(blockVars(colors));

        /* 2) Blockly 配色表 —— 第 34 轮：overrideColours 会把 more
              （自制积木分类色）一并换成主题色，恢复成作品里那一套，
              否则 Scratch 之后自己触发 procedures_call.updateColour()
              就会把粉色刷成别的颜色，即「有时忽然变色」。 */
        if (SB.Colours) {
            var savedMoreInTheme = null;
            try { savedMoreInTheme = SB.Colours.more; } catch (e0) { /* ignore */ }
            if (typeof SB.Colours.overrideColours === 'function') {
                SB.Colours.overrideColours(colors);
            }
            if (savedMoreInTheme) {
                try { SB.Colours.more = savedMoreInTheme; } catch (e2) { /* ignore */ }
            }
        }

        /* 3) 只有在 blocks-media 目录变化时才重建 Blockly 样式表（这一步最贵） */
        if (folder !== lastFolder && SB.Css && typeof SB.Css.inject === 'function') {
            var media = (SB.Css.mediaPath_ || '').replace(/blocks-media\/[^/]*$/, 'blocks-media/' + folder);
            SB.Css.inject(true, media);
        }
        lastFolder = folder;

        /* 4) 原地重绘 */
        repaintBlocks(SB, colors);
        patchToolboxCreate();
        patchFieldBlocks();
        paintCategoryBubbles(colors);
        watchToolbox();

        /* 4.5) 输入槽（shadow 积木）跟随界面主题 */
        applyFieldColors(SB);

        /* 5) 工作区底色/网格跟随界面主题（放在积木配色之后，保证以界面主题为准）。
           不受 myGuiActive 限制：用户在编辑器「设置」里改主题时也要跟着变。 */
        flushVars(WORKSPACE[currentTheme] || WORKSPACE.light);
        paintWorkspaceSurfaces();

        /* 6) 重新断言界面变量，防止编辑器把界面主题重置回原版 */
        if (myGuiActive) {
            resetVarCache();
            flushVars(guiVars(currentTheme));
        }

        /* 记住合并后的配色，供工具箱 / 抽屉重建后补色 */
        lastAppliedColors = colors;
        scheduleRecolor();
        watchBlocksArea();
        return true;
    }

    /* ---------------------------------------------------------------- *
     * 输入槽（数字框 / 下拉菜单）跟随界面主题
     *
     * 这些槽是 shadow 积木，底色 = Blockly.Colours.textField。
     * 只改 Colours 对已经画出来的积木无效（颜色在创建时就写进 SVG 了），
     * 所以要逐个重新着色：
     *   · setColourFromRawValues_ 改的是积木四色，其中 tertiary 是边框色
     *   · updateColour() 重画路径与槽底
     *   · 文字额外用内联样式强制指定 —— 下拉菜单的文字颜色是某个插件在
     *     init 时按当时底色算好的，换底色后不会自动重算，只能覆盖。
     * 新建的槽不受影响：那时 Colours.textField 已是新值，
     * init 阶段算出的对比色自然是对的。
     * ---------------------------------------------------------------- */
    function applyFieldColors(SB) {
        var fc = fieldColors();
        var root = document.documentElement;
        root.style.setProperty('--bl-field-bg', fc.bg);
        root.style.setProperty('--bl-field-text', fc.text);

        if (SB && SB.Colours) {
            SB.Colours.textField = fc.bg;
            SB.Colours.textFieldText = fc.text;
        }
        paintFieldBlocks(SB, fc);
    }

    var fieldPaintGen = 0, FIELD_CHUNK = 120;
    function paintFieldBlocks(SB, fc) {
        if (!SB) SB = window.ScratchBlocks || window.Blockly;
        if (!fc) fc = fieldColors();
        if (!SB || !fc) return;
        var wss = [];
        if (typeof SB.getMainWorkspace === 'function') {
            try {
                var mw = SB.getMainWorkspace();
                if (mw) wss.push(mw);
            } catch (e) { /* ignore */ }
        }
        try {
            var mw2 = SB.getMainWorkspace && SB.getMainWorkspace();
            if (mw2 && typeof mw2.getFlyout === 'function') {
                var fl = mw2.getFlyout();
                if (fl && typeof fl.getWorkspace === 'function') {
                    var fw = fl.getWorkspace();
                    if (fw) wss.push(fw);
                }
            }
        } catch (e2) { /* ignore */ }

        /* [B109] 分帧：shadow 积木也有上千个，一次跑完会占满动画窗口
           里的几帧。带代号，连续切换只跑最后一次。 */
        var gen = ++fieldPaintGen;
        var chunks = [], ci = 0, c = 0;
        for (var w = 0; w < wss.length; w++) {
            var bs = null;
            try { bs = wss[w].getAllBlocks(); } catch (e3) { continue; }
            if (!bs) continue;
            for (var i = 0; i < bs.length; i++) {
                if (!chunks[c]) chunks[c] = [];
                chunks[c].push(bs[i]);
                if (chunks[c].length >= FIELD_CHUNK) c++;
            }
        }
        if (!chunks.length || !chunks[0].length) return;
        var step = function () {
            if (gen !== fieldPaintGen) return;
            var list = chunks[ci++];
            if (list) {
                for (var j = 0; j < list.length; j++) {
                    try { paintOneFieldBlock(list[j], fc); } catch (e4) { /* ignore */ }
                }
            }
            if (ci < chunks.length && window.requestAnimationFrame) {
                window.requestAnimationFrame(step);
            }
        };
        if (chunks.length > 1 && window.requestAnimationFrame) {
            window.requestAnimationFrame(step);
        } else {
            while (ci < chunks.length) step();
        }
    }

    function paintOneFieldBlock(block, fc) {
        if (!block || typeof block.isShadow !== 'function') return;
        if (!block.isShadow()) return;
        try {
            if (typeof block.setColourFromRawValues_ === 'function') {
                block.setColourFromRawValues_(fc.bg, fc.bg, fc.border, fc.border);
            }
            if (typeof block.updateColour === 'function') block.updateColour();
            var root = typeof block.getSvgRoot === 'function' ? block.getSvgRoot() : null;
            if (!root || !root.querySelectorAll) return;
            var texts = root.querySelectorAll('text');
            for (var i = 0; i < texts.length; i++) {
                texts[i].style.setProperty('fill', fc.text, 'important');
            }
        } catch (e) { /* ignore */ }
    }

    /* 新建的 shadow 积木（切分类、从抽屉拖出）也要按当前主题着色 */
    function patchFieldBlocks() {
        var SB = window.ScratchBlocks || window.Blockly;
        if (!SB || !SB.Block || SB.Block.__blFieldPatched) return false;
        var proto = SB.Block.prototype;
        if (!proto || typeof proto.setColourFromRawValues_ !== 'function') return false;
        var orig = proto.init;
        if (typeof orig !== 'function') return false;
        proto.init = function () {
            var r = orig.apply(this, arguments);
            try {
                if (this.isShadow && this.isShadow() && !this.__blFieldPainted) {
                    this.__blFieldPainted = true;
                    paintOneFieldBlock(this, fieldColors());
                }
            } catch (e) { /* ignore */ }
            return r;
        };
        proto.__blFieldPatched = true;
        SB.Block.__blFieldPatched = true;
        return true;
    }

    /* Blockly 未就绪时按间隔重试，直到成功或超时 */
    function retryApply() {
        if (pendingApply) return;
        var tries = 0;
        pendingApply = window.setInterval(function () {
            tries++;
            var ok = syncBlocks(false);
            if (ok || tries > 120) {
                window.clearInterval(pendingApply);
                pendingApply = 0;
            }
        }, 250);
    }

    /* 工具箱/抽屉常在我们涂色之后被异步重建，这里补涂几次 */
    function scheduleRecolor() {
        var token = ++recolorSeq;
        /* 只补两轮：原来四轮全量重涂，大项目下会明显卡顿 */
        var delays = [TRANSITION_MS + 60, 1100];
        for (var k = 0; k < delays.length; k++) {
            window.setTimeout(function () {
                if (token !== recolorSeq) return;
                /* 加载作品期间排队的重涂直接丢弃：加载器结束时会统一补一次，
                   不必把同一批刚重建的积木再全量涂两遍。 */
                if (window.__blProjectLoading) return;
                /* 加载后 React 仍在重绘，这轮定时补色与加载器的轻量补色重复；
                   跳过它，主题的静态部分由加载器那一次补齐。 */
                var sinceLoad = Date.now() - (window.__blProjectLoadDoneAt || 0);
                if (sinceLoad >= 0 && sinceLoad < 2600) return;
                repaintAll(lastAppliedColors);
            }, delays[k]);
        }
    }

    /* 用已生效的配色把积木区整片重涂（不动 CSS 变量，可反复调用） */
    /* 作品加载期间 React 会重建几千块积木；若还按 200/900ms 定时补色、
       或按 DOM 变化补色，等于把同一批块 updateColour() 三到四遍。
       加载器置上 __blProjectLoading，这里挂起，结束后由它统一补一次。 */
    window.__blThemeRepaintNow = function (lightOnly) {
        var c = lastAppliedColors;
        if (!c) {
            var SB0 = window.ScratchBlocks || window.Blockly;
            if (SB0 && SB0.Colours) c = SB0.Colours;   /* 还没跑过主题应用时也能补色 */
        }
        if (c) repaintAll(c, lightOnly === true);
    };

    function repaintAll(colors, lightOnly) {
        var SB = window.ScratchBlocks || window.Blockly;
        if (!SB || !colors) return;
        if (window.__blProjectLoading) { pendingRepaintDuringLoad = true; return; }
        try { window.__blRepaintStats.passes++; } catch (e0) { /* ignore */ }
        /* overrideColours 会把 more（自制积木分类色）一并覆盖成主题色。
           先存后还，保证作品里已有的自制积木与新拖出的始终是同一套色。 */
        var savedMore = null;
        if (SB.Colours) { try { savedMore = SB.Colours.more; } catch (e0) { /* ignore */ } }
        if (SB.Colours && typeof SB.Colours.overrideColours === 'function') {
            try { SB.Colours.overrideColours(colors); } catch (e) { /* ignore */ }
        }
        if (savedMore && SB.Colours) {
            try { SB.Colours.more = savedMore; } catch (e2) { /* ignore */ }
        }
        if (lightOnly) {
            /* 轻量补色：跳过逐块 updateColour，只补重建后丢色的静态部分 */
            paintCategoryIcons(colors);
        } else {
            repaintBlocks(SB, colors);
        }
        /* 输入槽同样是重建后丢色的，一起补 */
        try { paintFieldBlocks(SB, null); } catch (e) { /* ignore */ }
        /* 底色是直写 DOM 的，工具箱 / 抽屉重建后会丢，这里补一次 */
        try { paintWorkspaceSurfaces(); } catch (e) { /* ignore */ }
    }

    /* 观察积木区容器：切换精灵 / 页签 / 扩展导致重建时自动补色 */
    function watchBlocksArea() {
        if (!window.MutationObserver) return;
        var host = document.querySelector('[class*="gui_blocks-wrapper_"]') ||
            document.querySelector('.injectionDiv') ||
            document.querySelector('svg.blocklySvg');
        if (!host || host.__blBlocksWatched) return;
        host.__blBlocksWatched = true;
        var pending = 0;
        var obs = new window.MutationObserver(function () {
            if (pending) return;
            pending = window.setTimeout(function () {
                pending = 0;
                if (window.__blProjectLoading) return;  /* 同上：不重放 */
                /* 加载刚结束的 1.8s 内只补静态部分：加载器已经做过一次
                   轻量补色，此时 React 还在持续重绘，再全量涂 1300 块
                   纯属重复劳动，且会和 VM 的角色/造型解码抢主线程。 */
                var since = Date.now() - (window.__blProjectLoadDoneAt || 0);
                if (since >= 0 && since < 2600) {
                    try { paintWorkspaceSurfaces(); } catch (e0) { /* ignore */ }
                    return;
                }
                try {
                    if (lastAppliedColors) repaintAll(lastAppliedColors);
                    else paintWorkspaceSurfaces();
                } catch (e) { /* ignore */ }
            }, 400);
        });
        obs.observe(host, { childList: true, subtree: true });
    }

    /* 积木栏 / 工作区底色：直接按当前明暗取色，不依赖 CSS 变量。
       之前这里读 --editorTheme3-* 变量，而变量只在"我们的轮盘接管界面"时才写入；
       用户在编辑器「设置」里改主题时变量为空，上色就整体失效了
       —— 表现就是积木栏背景不跟随主题。现在改为查表，随时可用。 */
    function workspaceColors() {
        return WORKSPACE[currentTheme] || WORKSPACE.light;
    }

    /* ---------------------------------------------------------------- *
     * 积木栏背景：必须由 CSS 规则控制，不能只靠 setAttribute
     *
     * 原因：Blockly 的样式表里写的是
     *     .blocklyFlyoutBackground { fill: $colour_flyout; fill-opacity: .8; }
     *     .scratchCategoryMenu     { background: $colour_toolbox; }
     * 其中 $colour_flyout / $colour_toolbox 在 Blockly.Css.inject() 时
     * 就被替换成了【当时】的固定颜色值。
     * 而 setAttribute('fill', ...) 写的是 SVG 呈现属性（presentation
     * attribute），优先级低于任何 CSS 类规则 —— 也就是说无论我们设成什么，
     * 都会被上面这条类规则盖掉。
     * 于是切换主题时积木栏纹丝不动，只有刷新后 Css.inject 用新配色
     * 重新生成样式表才生效 —— 这正是"需要刷新才跟随"的根因。
     *
     * 修法：注入一张自己的样式表，用 !important 压过类规则，
     * 颜色用 var() 引用我们在切换主题时写入的变量。这样：
     *   · 优先级最高（!important）
     *   · 节点重建后自动生效（CSS 天然覆盖，不需要观察器补色）
     *   · 切主题只改变量 → 立即生效，不刷新、不重建样式表
     * ---------------------------------------------------------------- */
    var SURFACE_STYLE_ID = 'bl-surface-colors';

    function ensureSurfaceStyle() {
        var el = document.getElementById(SURFACE_STYLE_ID);
        if (el) return el;
        el = document.createElement('style');
        el.id = SURFACE_STYLE_ID;
        /* 用专用的 --bl-* 变量，而不是 --editorTheme3-*：
           后者编辑器自己也会写，两边会互相覆盖，导致樱花 / 深海这类
           自定义主题的背景被编辑器拉回它自己的配色。
           每个 var() 都带亮色兜底值：变量还没写入时不会让属性失效。 */
        el.textContent =
            'svg.blocklyFlyout {' +
            ' background-color: var(--bl-flyout-bg, #ffffff) !important; }' +
            '.blocklyFlyoutBackground {' +
            ' fill: var(--bl-flyout-bg, #ffffff) !important; }' +
            '.blocklyFlyoutScrollbar {' +
            ' fill: var(--bl-scrollbar, #cecdce) !important; }' +
            'svg.blocklyToolbox, .blocklyToolboxDiv, .scratchCategoryMenu, .scratchCategoryMenuRow {' +
            ' background-color: var(--bl-toolbox-bg, #ffffff) !important; }' +
            '.blocklyToolboxBackground {' +
            ' fill: var(--bl-toolbox-bg, #ffffff) !important; }' +
            /* Blockly 注入的那条 .blocklyToolboxDiv 是写死的字面色（不是 var()），
               只在 Blockly 重新注入时才重算。运行时从暗色切亮色，它会停在
               color:#cccccc —— 白底浅灰字，等于没切。这里用 !important 压掉。 */
            '.blocklyToolboxDiv, .scratchCategoryMenu, .scratchCategoryMenuRow {' +
            ' color: var(--bl-toolbox-text, #575e75) !important; }' +
            '.blocklyTreeLabel, .blocklyFlyoutLabelText, .scratchCategoryMenuItemLabel {' +
            ' fill: var(--bl-toolbox-text, #575e75) !important;' +
            ' color: var(--bl-toolbox-text, #575e75) !important; }' +
            'svg.blocklySvg {' +
            ' background-color: var(--bl-workspace-bg, #ffffff) !important; }';
        (document.head || document.documentElement).appendChild(el);
        return el;
    }

    function paintWorkspaceSurfaces() {
        var ws = workspaceColors();
        ensureSurfaceStyle();

        /* 把当前主题的底色写进专用变量 —— 样式表用 var() 引用它们，
           所以切主题时只要改这几个变量，积木栏背景立刻跟着变，
           既不用重建样式表，也不用等节点重建后靠观察器补色。 */
        var root = document.documentElement;
        root.style.setProperty('--bl-workspace-bg', ws['editorTheme3-workspace-background'] || '#ffffff');
        root.style.setProperty('--bl-toolbox-bg', ws['editorTheme3-toolbox-background'] || '#ffffff');
        root.style.setProperty('--bl-flyout-bg', ws['editorTheme3-flyout-background'] || '#ffffff');
        root.style.setProperty('--bl-toolbox-text', ws['editorTheme3-toolbox-text'] || '#575e75');
        root.style.setProperty('--bl-scrollbar', ws['editorTheme3-scrollbar'] || '#cecdce');

        var svg = document.querySelector('svg.blocklySvg');
        if (svg && ws['editorTheme3-workspace-background']) {
            svg.style.setProperty('background-color', ws['editorTheme3-workspace-background'], 'important');
        }

        /* 抽屉（积木列表那一栏） */
        var fs = document.querySelector('svg.blocklyFlyout');
        if (fs && ws['editorTheme3-flyout-background']) {
            fs.style.setProperty('background-color', ws['editorTheme3-flyout-background'], 'important');
        }
        each('svg.blocklyFlyout > path.blocklyFlyoutBackground, svg.blocklyFlyout > rect.blocklyFlyoutBackground',
            function (fb) {
                if (fb.setAttribute) fb.setAttribute('fill', ws['editorTheme3-flyout-background']);
            });

        /* 分类栏：Blockly 原生树形 + Scratch 风格分类菜单，两种都要覆盖 */
        each('svg.blocklyToolbox, .scratchCategoryMenu, .scratchCategoryMenuRow', function (el) {
            el.style.setProperty('background-color', ws['editorTheme3-toolbox-background'], 'important');
        });
        each('svg.blocklyToolbox > path.blocklyToolboxBackground, svg.blocklyToolbox > rect.blocklyToolboxBackground',
            function (tb) {
                if (tb.setAttribute) tb.setAttribute('fill', ws['editorTheme3-toolbox-background']);
            });
        each('.scratchCategoryMenuItem', function (el) {
            el.style.setProperty('background-color', 'transparent', 'important');
        });

        /* 分类文字 / 抽屉小标题：跟随明暗，否则深色底上是深色字看不见 */
        each('.blocklyTreeLabel, .blocklyFlyoutLabelText, .scratchCategoryMenuItemLabel', function (el) {
            el.style.setProperty('fill', ws['editorTheme3-toolbox-text'], 'important');
            el.style.setProperty('color', ws['editorTheme3-toolbox-text'], 'important');
        });

        if (ws['editorTheme3-grid-color']) {
            var SB = window.ScratchBlocks;
            var w = SB && typeof SB.getMainWorkspace === 'function' ? SB.getMainWorkspace() : null;
            if (w && w.grid_ && w.grid_.pattern && w.grid_.pattern.setAttribute) {
                w.grid_.pattern.setAttribute('fill', ws['editorTheme3-grid-color']);
            }
        }
        if (ws['editorTheme3-scrollbar']) {
            var SB2 = window.ScratchBlocks;
            var w2 = SB2 && typeof SB2.getMainWorkspace === 'function' ? SB2.getMainWorkspace() : null;
            if (w2 && w2.scrollbar) {
                var sb = ws['editorTheme3-scrollbar'];
                if (w2.scrollbar.vScroll && w2.scrollbar.vScroll.outerSvg_) {
                    w2.scrollbar.vScroll.outerSvg_.style.fill = sb;
                }
                if (w2.scrollbar.hScroll && w2.scrollbar.hScroll.outerSvg_) {
                    w2.scrollbar.hScroll.outerSvg_.style.fill = sb;
                }
            }
        }
    }

    /* 工具箱分类栏的圆形色块是在 toolbox XML 生成时固化的，
       换主题不会自动刷新，这里按分类 id 直接重着色。
       同时兼容 .scratchCategoryItemIcon（有图标的分类走这个类名）。 */
    function paintCategoryBubbles(colors) {
        var items = document.querySelectorAll('[class*="scratchCategoryId-"]');
        for (var i = 0; i < items.length; i++) {
            var m = /scratchCategoryId-([\w-]+)/.exec(items[i].className || '');
            if (!m) continue;
            var colorId = CATEGORY_ID_MAP[m[1]];
            var c = colorId ? colors[colorId] : null;
            if (!c) continue;
            /* 圆点可能是 Bubble（纯色）或 Icon（带图标），两者都要上色；
               都没有时退回第一个子元素 */
            var bubble = items[i].querySelector('.scratchCategoryItemBubble') ||
                items[i].querySelector('.scratchCategoryItemIcon') ||
                items[i].firstElementChild;
            if (!bubble) continue;
            if (c.primary) bubble.style.setProperty('background-color', c.primary, 'important');
            /* 边框用 tertiary：暗色主题下它是亮色，圆点边缘才看得清 */
            if (c.tertiary || c.secondary) {
                bubble.style.setProperty('border-color', c.tertiary || c.secondary, 'important');
            }
        }
        /* 分类文字颜色：跟随界面主题明暗 */
        var text = toolboxTextColor();
        each('.scratchCategoryMenuItemLabel', function (el) {
            el.style.setProperty('color', text, 'important');
        });
        each('.blocklyTreeLabel', function (el) {
            el.style.setProperty('fill', text, 'important');
            el.style.setProperty('color', text, 'important');
        });
        /* 抽屉里的小标题 */
        var fh = flyoutTextColor();
        each('.blocklyFlyoutLabelText', function (el) {
            el.style.setProperty('fill', fh, 'important');
        });
    }

    /* 工具箱会随精灵/页签切换重建，重建后上面涂的色会丢。
       这里在重建源头（Category.createDom）补一次，并用 observer 兜底。 */
    function patchToolboxCreate() {
        var SB = window.ScratchBlocks;
        if (!SB || !SB.Toolbox || !SB.Toolbox.Category) return false;
        var proto = SB.Toolbox.Category.prototype;
        if (proto.__blCreatePatched) return false;
        var orig = proto.createDom;
        if (typeof orig !== 'function') return false;
        proto.createDom = function () {
            var r = orig.apply(this, arguments);
            try {
                if (this.bubble_ && this.id_) {
                    var colors = currentColors();
                    if (colors) {
                        var colorId = CATEGORY_ID_MAP[this.id_];
                        var c = colorId ? colors[colorId] : null;
                        if (c) {
                            if (c.primary) this.bubble_.style.setProperty('background-color', c.primary, 'important');
                            if (c.tertiary || c.secondary) {
                                this.bubble_.style.setProperty('border-color', c.tertiary || c.secondary, 'important');
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }
            return r;
        };
        proto.__blCreatePatched = true;
        return true;
    }

    /* 当前生效的积木配色（供重建时补色用） */
    function currentColors() {
        var SB = window.ScratchBlocks;
        if (!SB || !SB.Colours) return null;
        return SB.Colours;
    }

    /* 工具箱容器变更时补一次色（重建兜底） */
    function watchToolbox() {
        if (!window.MutationObserver) return;
        var host = document.querySelector('.scratchCategoryMenu') ||
            document.querySelector('div[class*="gui_toolbox_"]') ||
            document.querySelector('.blocklyToolboxDiv');
        if (!host || host.__blToolboxWatched) return;
        host.__blToolboxWatched = true;
        var pending = 0;
        var obs = new window.MutationObserver(function () {
            if (pending) return;
            pending = window.setTimeout(function () {
                pending = 0;
                var colors = currentColors();
                if (colors) paintCategoryBubbles(colors);
            }, 60);
        });
        obs.observe(host, { childList: true, subtree: true });
    }

    /* 单块上色 */
    /* 自制积木的颜色保护（第 34 轮）
       ------------------------------------------------------------------
       procedures_call / procedures_definition / procedures_declaration /
       argument_reporter_* 这类块不走分类色，Scratch 在 updateColour() 里
       会按「当时的 Blockly.Colours.more」重算自己的粉色。主题模块的
       overrideColours() 会把 more 换成当前主题的分类色，于是定时补色
       （200/900ms）或 DOM 变化补色（400ms）一跑，摆好的自制积木就
       「忽然变色」。这些块一律跳过补色，保留创建时的颜色。 */
    var PROCEDURE_BLOCK_RE = /^(procedures_|argument_reporter_)/;
    /* 可观测：工具箱「性能」面板与加载耗时分析都能读到补色开销 */
    window.__blRepaintStats = { blocks: 0, skipped: 0, passes: 0 };

    function paintOneBlock(b) {
        if (!b) return;
        var st = window.__blRepaintStats;
        var ty = '';
        try { ty = b.type || ''; } catch (e0) { /* ignore */ }
        if (typeof ty === 'string' && PROCEDURE_BLOCK_RE.test(ty)) {
            st.skipped++;
            return;
        }
        st.blocks++;
        if (typeof b.updateColour === 'function') {
            try { b.updateColour(); } catch (e) { /* ignore */ }
        }
    }

    /* 重涂一个工作区里的所有积木。
       积木多的时候必须分帧：每块 updateColour 都会重排 SVG，
       几千块一次跑完会把主线程占满，表现为界面冻住、作品“跑不起来”。 */
    var CHUNK = 120;

    function paintWorkspaceBlocks(target) {
        if (!target || typeof target.getAllBlocks !== 'function') return;
        var list;
        try { list = target.getAllBlocks(); } catch (e) { return; }
        if (!list || !list.length) return;
        if (list.length <= CHUNK) {
            for (var i = 0; i < list.length; i++) paintOneBlock(list[i]);
            return;
        }
        var idx = 0;
        var step = function () {
            var end = Math.min(idx + CHUNK, list.length);
            for (; idx < end; idx++) paintOneBlock(list[idx]);
            if (idx < list.length && window.requestAnimationFrame) {
                window.requestAnimationFrame(step);
            }
        };
        if (window.requestAnimationFrame) window.requestAnimationFrame(step);
        else for (var j = 0; j < list.length; j++) paintOneBlock(list[j]);
    }

    function repaintBlocks(SB, colors) {
        var ws = typeof SB.getMainWorkspace === 'function' ? SB.getMainWorkspace() : null;

        function repaintAll(target) {
            paintWorkspaceBlocks(target);
        }

        if (ws) {
            var flyout = typeof ws.getFlyout === 'function' ? ws.getFlyout() : null;
            if (flyout && colors.flyout && typeof flyout.setBackgroundColour_ === 'function') {
                try { flyout.setBackgroundColour_(colors.flyout); } catch (e) { /* ignore */ }
            }
            repaintAll(ws);
            if (flyout && typeof flyout.getWorkspace === 'function') {
                repaintAll(flyout.getWorkspace());
            }
        }

        /* 抽屉里的分类小标题：跟随界面主题明暗 */
        var fh = flyoutTextColor();
        each('.blocklyFlyoutLabelText', function (el) {
            el.style.setProperty('fill', fh, 'important');
        });

        /* 切换分类后抽屉会新建积木，包一层 show 保证新积木也上色 */
        if (flyout && !flyout.__blShowPatched && typeof flyout.show === 'function') {
            var origShow = flyout.show;
            flyout.show = function () {
                var r = origShow.apply(this, arguments);
                /* 只补抽屉里新建的积木，不要整片重涂（切分类很频繁） */
                try {
                    var fw = typeof this.getWorkspace === 'function' ? this.getWorkspace() : null;
                    if (fw) paintWorkspaceBlocks(fw);
                } catch (e) { /* ignore */ }
                return r;
            };
            flyout.__blShowPatched = true;
        }

        paintCategoryIcons(colors);
    }

    /* 分类栏图标上色。
       编辑器自带实现读 Colours.categoryTypeToColorMap，但这个表在打包代码里
       并不存在（取值会抛错并被 try/catch 吞掉），所以官方换主题时分类颜色
       同样纹丝不动。这里改为自己按分类 id 取色，数据层与两种 DOM 都覆盖。 */
    function paintCategoryIcons(colors) {
        var i, c, cat;

        /* 1) 数据层：直接改分类对象，后续重建也会带上新色 */
        var ws = null;
        var SB = window.ScratchBlocks || window.Blockly;
        if (SB && typeof SB.getMainWorkspace === 'function') {
            try { ws = SB.getMainWorkspace(); } catch (e) { ws = null; }
        }
        var tb = ws && ws.toolbox_;
        var menu = tb && (tb.categoryMenu_ || tb.tree_);
        var cats = menu && menu.categories_;
        if (cats && cats.length) {
            for (i = 0; i < cats.length; i++) {
                cat = cats[i];
                if (!cat) continue;
                var cid = cat.id_ ||
                    (typeof cat.getCategoryId === 'function' ? cat.getCategoryId() : '');
                c = colors[CATEGORY_ID_MAP[cid]];
                if (!c) continue;
                if (c.primary) cat.colour_ = c.primary;
                if (c.tertiary || c.secondary) cat.secondaryColour_ = c.tertiary || c.secondary;
                paintBubble(cat.bubble_ || (cat.item_ && cat.item_.firstElementChild), c);
            }
        }

        /* 2) DOM 层 A：Blockly 经典树形工具箱（本编辑器实际用的就是这套） */
        each('.blocklyTreeIcon', function (el) {
            var row = el.closest ? el.closest('.blocklyTreeRow') : null;
            var label = row ? row.querySelector('.blocklyTreeLabel') : null;
            var key = label ? label.getAttribute('data-category') : null;
            var cc = key ? colors[CATEGORY_ID_MAP[key]] : null;
            if (cc && cc.primary) el.style.setProperty('background-color', cc.primary, 'important');
        });

        /* 3) DOM 层 B：Scratch 风格分类菜单 */
        each('[class*="scratchCategoryId-"]', function (el) {
            var m = /scratchCategoryId-([\w-]+)/.exec(el.className || '');
            if (!m) return;
            var cc = colors[CATEGORY_ID_MAP[m[1]]];
            if (cc) {
                paintBubble(el.querySelector('.scratchCategoryItemBubble') ||
                    el.querySelector('.scratchCategoryItemIcon') ||
                    el.firstElementChild, cc);
            }
        });

        /* 4) 分类文字颜色：跟随界面主题明暗（圆点与积木仍固定亮色配色） */
        var text = toolboxTextColor();
        each('.blocklyTreeLabel, .scratchCategoryMenuItemLabel', function (el) {
            el.style.setProperty('fill', text, 'important');
            el.style.setProperty('color', text, 'important');
        });
    }

    function paintBubble(bubble, c) {
        if (!bubble || !bubble.style) return;
        if (c.primary) bubble.style.setProperty('background-color', c.primary, 'important');
        if (c.tertiary || c.secondary) {
            bubble.style.setProperty('border-color', c.tertiary || c.secondary, 'important');
        }
    }

    /* 让编辑器内部（含重建工具箱 XML）取到的也是合并后的配色 */
    function patchThemeColors() {
        var store = window.ReduxStore;
        if (!store || typeof store.getState !== 'function') return false;
        var state = store.getState();
        var theme = state && state.scratchGui && state.scratchGui.theme && state.scratchGui.theme.theme;
        if (!theme) return false;
        var proto = Object.getPrototypeOf(theme);
        if (!proto || proto.__blColorsPatched) return false;
        var orig = proto.getBlockColors;
        if (typeof orig !== 'function') return false;
        /* 缓存“blocks=three 的副本”。
           必须缓存：自制积木渲染时 getBlockColors 会被逐块调用
           （procedures_call 的 updateColour 里就有一处），
           不缓存就会每块都新建一个完整主题对象，大项目下直接卡死。 */
        var copyCache = (typeof WeakMap === 'function') ? new WeakMap() : null;

        proto.getBlockColors = function () {
            /* 积木配色锁定为亮色主题：忽略 redux 里的 blocks，一律按 three 取色。
               只在取值层面纠正，不 dispatch，避免重建工作区导致灰屏。 */
            if (this.blocks === 'three') return orig.call(this);
            var copy = null;
            if (copyCache) {
                copy = copyCache.get(this);
                if (!copy) {
                    try {
                        copy = this.set('blocks', 'three');
                        if (copy) copyCache.set(this, copy);
                    } catch (e) { /* ignore */ }
                }
            } else {
                copy = this.__blThreeCopy;
                if (!copy) {
                    try {
                        copy = this.set('blocks', 'three');
                        this.__blThreeCopy = copy;
                    } catch (e) { /* ignore */ }
                }
            }
            return orig.call(copy || this);
        };
        proto.__blColorsPatched = true;
        return true;
    }

    /* ================================================================== *
     * 主题面板（固定在「主题」按钮下方的下拉弹窗）
     *
     * 原来是一个圆形转盘，只有 4 个格子，加不进更多预设。
     * 现在换成下拉面板：按分组列出预设色板，底部是「自定义主题色」入口。
     * 面板挂进顶层宿主（#bl-top-layer），因此不会被积木栏 / 舞台压住。
     * ================================================================== */

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* 颜色球只显示纯色：主题本身的渐变层（bl-grad-on）与自定义
       渐变编辑器完全保留，这里只改「球长什么样」，不再画 linear-gradient。
       渐变主题取平均色标的实色，普通主题取 swatch。 */
    function swatchStyle(item) {
        var t = THEMES[item.id];
        var c = item.swatch || (t && t.swatch) || item.accent ||
                (t && t.accent) || '#4c97ff';
        if (typeof c !== 'string') c = '#4c97ff';
        /* 渐变编辑器存进来的 swatch 可能是 CSS 渐变串，只取第一个色标 */
        if (c.indexOf('gradient') >= 0) {
            var m = c.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/);
            c = m ? m[0] : (item.accent || '#4c97ff');
        }
        return 'background-color:' + c;
    }

    function buildPanel() {
        var html = '<div class="tw-panel">';
        html += '<div class="tw-panel-head">主题色</div>';
        html += '<div class="tw-panel-body">';

        for (var gi = 0; gi < PRESETS.length; gi++) {
            var grp = PRESETS[gi];
            if (!grp.items.length) continue;
            html += '<div class="tw-group">';
            html += '<div class="tw-group-title">' + esc(grp.label) + '</div>';
            html += '<div class="tw-swatches">';
            for (var k = 0; k < grp.items.length; k++) {
                var it = grp.items[k];
                var canDel = grp.id === 'custom';
                html += '<span class="tw-slot">' +
                    '<button type="button" class="tw-swatch" data-theme="' + esc(it.id) + '"' +
                    ' title="' + esc(it.label) + '" role="radio" aria-checked="false">' +
                    '<span class="tw-swatch-ball" style="' + swatchStyle(it) + '">' +
                    '<span class="tw-swatch-check" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
                    '</span></span>' +
                    '<span class="tw-swatch-name">' + esc(it.label) + '</span>' +
                    '</button>' +
                    (canDel
                        ? '<button type="button" class="tw-swatch-del" data-del="' + esc(it.id) + '"' +
                          ' title="删除「' + esc(it.label) + '」" aria-label="删除 ' + esc(it.label) + '">' +
                          '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"' +
                          ' stroke-width="2.4" stroke-linecap="round">' +
                          '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
                          '</button>'
                        : '') +
                    '</span>';
            }
            html += '</div></div>';
        }

        html += '</div>';
        html += '<div class="tw-panel-foot">' +
            '<button type="button" class="tw-custom-btn" data-action="custom">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9l6 4"/></svg>' +
            '<span>自定义主题色</span></button>' +
            '</div>';
        html += '</div>';
        return html;
    }

    var panelEl = null;
    var closeTimer = 0, previewId = null, previewBase = null;
    function cancelClose() {
        if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = 0; }
    }
    function scheduleClose() {
        cancelClose();
        closeTimer = window.setTimeout(function () {
            closeTimer = 0;
            if (panelOpen) closePanel();
        }, 220);   /* 按钮 → 面板之间 6px 空隙的移动宽限 */
    }
    function resetPreview() {
        if (previewId != null) {
            try {
                var ctl = window.__blThemeCtl;
                if (ctl && typeof ctl.preview === 'function') ctl.preview(ctl.current());
            } catch (e) { /* ignore */ }
            previewId = null;
        }
        previewBase = null;
    }

    function ensurePanel() {
        if (panelEl && panelEl.parentNode) return panelEl;
        var host = blTopLayer();
        var box = document.createElement('div');
        box.className = 'tw-panel-wrap';
        box.innerHTML = buildPanel();
        panelEl = box.firstChild;
        host.appendChild(panelEl);
        panelEl.addEventListener('mouseenter', cancelClose);
        panelEl.addEventListener('mouseleave', function () {
            resetPreview();
            scheduleClose();
        });
        bindPanel();
        markActive(currentTheme);
        return panelEl;
    }

    /* 重新渲染（新增 / 删除自定义主题后） */
    function rebuildPanel() {
        /* [B109] 自定义主题增删后，按 id 缓存的预览变量必须失效，
           否则同名 id 重建会继续预览旧配色。 */
        try { for (var pk in previewVarsCache) delete previewVarsCache[pk]; } catch (ePk) {}
        if (!panelEl) return;
        var wasOpen = panelOpen;
        var box = document.createElement('div');
        box.innerHTML = buildPanel();
        var next = box.firstChild;
        if (wasOpen) next.classList.add('is-open');
        if (panelEl.parentNode) panelEl.parentNode.replaceChild(next, panelEl);
        panelEl = next;
        /* 新节点同样要接管「移入保持 / 移出延迟收起」，否则删完自定义
           主题后面板就再也不会自动收起 */
        panelEl.addEventListener('mouseenter', cancelClose);
        panelEl.addEventListener('mouseleave', function () {
            resetPreview();
            scheduleClose();
        });
        bindPanel();
        markActive(currentTheme);
        /* 色球数量变了（新增 / 删除自定义主题），高度要重新量 */
        sizePanel();
        if (wasOpen) positionPanel();
    }

    /* 删除自定义主题。删掉的正好是当前主题时先切回亮色，
       否则界面会继续引用一个已被移除的 id。 */
    function deleteTheme(id) {
        var t = THEMES[id];
        var label = (t && t.label) || '该主题';
        if (!window.confirm('删除主题「' + label + '」？此操作无法撤销。')) return;
        var wasCurrent = currentTheme === id;
        removeCustomTheme(id);
        if (wasCurrent) {
            try { applyTheme('light', true, true); } catch (e) { /* ignore */ }
        }
        rebuildPanel();
    }

    function bindPanel() {
        if (!panelEl || panelEl.__blBound) return;
        panelEl.__blBound = true;
        /* 移到颜色球：只做轻量变量预览（不写存档、不重涂积木），
           单击才完整应用并收起面板；移出面板自动还原。 */
        panelEl.addEventListener('mouseover', function (e) {
            var t = e.target;
            var btn = t && t.closest ? t.closest('[data-theme]') : null;
            if (!btn) return;
            var id = btn.getAttribute('data-theme');
            if (!THEMES[id] || id === previewId) return;
            var ctl = window.__blThemeCtl;
            if (!ctl) return;
            if (previewBase == null) previewBase = ctl.current();
            previewId = id;
            try { ctl.preview(id); } catch (err) { /* ignore */ }
        });
        panelEl.addEventListener('click', function (e) {
            var del = e.target && e.target.closest ? e.target.closest('[data-del]') : null;
            if (del) {
                e.preventDefault();
                e.stopPropagation();
                deleteTheme(del.getAttribute('data-del'));
                return;
            }
            var t = e.target;
            if (!t || !t.closest) return;
            var btn = t.closest('[data-theme]');
            if (btn) {
                e.stopPropagation();
                var id = btn.getAttribute('data-theme');
                if (THEMES[id]) {
                    /* 取消预览态，走完整应用：写存档 / 同步 redux / 分帧重涂 */
                    previewId = null; previewBase = null;
                    applyTheme(id, true, true);
                    closePanel();
                }
                return;
            }
            var act = t.closest('[data-action="custom"]');
            if (act) {
                e.stopPropagation();
                resetPreview();
                closePanel();
                openGradientEditor();
            }
        });
    }

    /* 面板高度自适应：
       先量出内容的自然高度（色球越多越高），再用阈值夹一遍。
       超过阈值就固定为阈值，由 .tw-panel-body 内部滚动查看剩余的色球，
       而不是让面板一路长到屏幕外。 */
    var PANEL_MAX_VH = 0.72, PANEL_MAX_PX = 620;

    function sizePanel() {
        if (!panelEl) return;
        var body = panelEl.querySelector('.tw-panel-body');
        /* 直接读 panelEl.scrollHeight 量不到真实高度：
           body 是 overflow-y:auto 的 flex 子项，会先收缩到容器剩余空间，
           于是 scrollHeight 恒等于 max-height（约 620），色球多少都一样。
           测量时临时取消它的收缩，让内容把面板撑开。 */
        var pf = body ? body.style.flex : '';
        var po = body ? body.style.overflow : '';
        if (body) { body.style.flex = 'none'; body.style.overflow = 'visible'; }
        panelEl.style.maxHeight = 'none';
        var natural = panelEl.offsetHeight || 0;
        if (body) { body.style.flex = pf; body.style.overflow = po; }
        var limit = Math.round(Math.min(window.innerHeight * PANEL_MAX_VH, PANEL_MAX_PX));
        panelEl.style.maxHeight = (natural > 0 ? Math.min(natural, limit) : limit) + 'px';
    }


    function positionPanel() {
        /* React 重绘可能换掉按钮节点，取当前 DOM 里的那个 */
        var live = document.querySelector('.tw-theme-btn');
        if (live) themeBtn = live;
        if (!panelEl || !themeBtn) return;
        sizePanel();
        var r = themeBtn.getBoundingClientRect();
        var w = panelEl.offsetWidth || 300;
        var h = panelEl.offsetHeight || 380;
        var W = window.innerWidth, H = window.innerHeight;
        var left = r.left;
        left = Math.max(8, Math.min(left, W - 8 - w));
        var top = r.bottom + 6;
        /* 下方空间不够就往上翻；还不够就压缩高度并贴边 */
        if (top + h > H - 8) {
            var up = r.top - h - 6;
            top = up >= 8 ? up : Math.max(8, H - 8 - h);
        }
        panelEl.style.left = left + 'px';
        panelEl.style.top = top + 'px';
    }

    function closePanel() {
        /* Esc / 点外部收起时鼠标可能仍在面板上，没走 mouseleave，
           这里兜底把 hover 预览还原成已确认的主题色 */
        resetPreview();
        var g = ++panelGen;
        panelOpen = false;
        if (!panelEl || !panelEl.classList.contains('is-open')) return;
        panelEl.classList.add('is-closing');
        /* 与窗口同一套关闭动画：先播完，再摘掉 is-open。
           g 过期说明期间又被打开过，这次回调不能碰 DOM。 */
        popOut(panelEl, function () {
            if (g !== panelGen) return;
            if (panelEl) panelEl.classList.remove('is-open', 'is-closing');
        });
    }

    function openPanel() {
        ensurePanel();
        ++panelGen;                 /* 让所有在途的关闭回调失效 */
        panelOpen = true;
        sizePanel();
        positionPanel();
        /* 先定位再显形，避免先画在旧位置再跳过去 */
        panelEl.classList.remove('is-closing');
        panelEl.classList.add('is-open');
        panelEl.__blPopMs = 240; panelEl.__blExitMs = 180;
        popIn(panelEl);
        markActive(currentTheme);
        positionPanel();
    }

    function togglePanel() {
        if (panelOpen) closePanel();
        else openPanel();
    }

    /* 兼容旧调用名（markActive 在原流程里被调用多次） */
    function markActive(name) {
        var host = panelEl || document.querySelector('.tw-panel');
        if (!host) return;
        var all = host.querySelectorAll('.tw-swatch');
        for (var i = 0; i < all.length; i++) {
            var on = all[i].getAttribute('data-theme') === name;
            all[i].classList.toggle('is-active', on);
            if (on) all[i].setAttribute('aria-checked', 'true');
            else all[i].removeAttribute('aria-checked');
        }
    }

    /* ================================================================== *
     * 渐变主题编辑器（「自定义主题色」弹出的窗口）
     *
     * 用户可以：
     *   · 命名 / 写描述
     *   · 点快速预设（日落 / 海洋 / 森林 / 紫雨）
     *   · 在渐变条上加色标、改色、拖动位置、复制
     *   · 调渐变方向
     *   · 切换明暗
     *   · 预览 / 创建
     * 创建后主题写进 localStorage 并出现在面板的「我的主题」分组里。
     * ================================================================== */

    var gradWin = null;
    var gradState = null;

    function defaultGradState() {
        return {
            name: '我的渐变主题',
            desc: '一个自定义渐变主题',
            stops: [{ color: '#ffd166', pos: 0 }, { color: '#ff6b6b', pos: 100 }],
            angle: 90,
            dark: false,
            sel: 0,
            prev: null
        };
    }

    /* ------------------------------------------------------------------ *
     * 渐变主题：把色标渲染成真正的 CSS 渐变
     *
     * 之前 grad 只被存进 THEMES[id].grad，guiVars() 却从不读它，
     * 界面用的仍是 deriveGui(accent) 派生的【纯色】—— 所以自建主题
     * 无论怎么配色都只显示纯色。
     *
     * 直接把渐变塞进 --ui-* 变量有硬伤：编辑器里 page-background /
     * fullscreen-background / menu-bar-background 用的是 background-color，
     * 渐变值在那里会被整条声明丢弃（背景变透明）。
     * 所以分成两层：
     *   1) --bl-grad-* 存真实渐变，由本文件注入的 CSS 铺在 <html> 上（背景层）
     *   2) --ui-* 大面积背景改成【半透明】柔和色，让底层渐变透出来
     * 文字色 / 边框色 / 强调色一律保持纯色不变，保证可读性。
     * ------------------------------------------------------------------ */

    /* stops: [{color,pos}] -> "linear-gradient(90deg, #a 0%, #b 100%)" */
    function gradToCss(stops, angle) {
        var list = normalizeStops(stops);
        if (!list.length) return '';
        var parts = [];
        for (var i = 0; i < list.length; i++) {
            parts.push(list[i].color + ' ' + Math.round(list[i].pos) + '%');
        }
        return 'linear-gradient(' + (typeof angle === 'number' ? angle : 90) + 'deg, ' + parts.join(', ') + ')';
    }

    /* 归一化：兼容只存颜色数组（旧数据）与带 pos 的对象数组 */
    function normalizeStops(stops) {
        if (!stops || !stops.length) return [];
        var out = [];
        for (var i = 0; i < stops.length; i++) {
            var st = stops[i];
            if (typeof st === 'string') {
                out.push({ color: st, pos: stops.length === 1 ? 50 : (i / (stops.length - 1)) * 100 });
            } else if (st && st.color) {
                out.push({ color: st.color, pos: typeof st.pos === 'number' ? clampN(st.pos, 0, 100) : 0 });
            }
        }
        if (!out.length) return [];
        if (out.length === 1) {
            /* 单色也要能形成渐变：补一个端点 */
            out.push({ color: out[0].color, pos: 100 });
            out[0].pos = 0;
        }
        out.sort(function (a, b) { return a.pos - b.pos; });
        return out;
    }

    /* 渐变平均色：给 background-color 场景当兜底，避免背景被丢成透明 */
    function gradAverage(stops) {
        var list = normalizeStops(stops);
        if (!list.length) return '#4c97ff';
        var r = 0, g = 0, b = 0, w = 0;
        for (var i = 0; i < list.length; i++) {
            var c = hexToRgb(list[i].color);
            var wt = i === 0 || i === list.length - 1 ? 0.5 : 1;
            r += c.r * wt; g += c.g * wt; b += c.b * wt; w += wt;
        }
        if (!w) return '#4c97ff';
        return rgbToHex(r / w, g / w, b / w);
    }

    /* 把已有的 hsla/hsl 变量调成半透明，让底层渐变透出。
       只改背景类，不动文字与边框。 */
    function alphaize(v, alpha) {
        var str = String(v || '');
        var m = str.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
        if (m) {
            return 'hsla(' + m[1] + ', ' + m[2] + '%, ' + m[3] + '%, ' + alpha + ')';
        }
        if (str.charAt(0) === '#') {
            var c = hexToRgb(str);
            return 'rgba(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ', ' + alpha + ')';
        }
        return str;
    }

    /* 有渐变时：把大面积背景改成半透明，并挂上 --bl-grad-* */
    function applyGradLayer(out, grad, dark) {
        if (!grad) return out;
        var stops = normalizeStops(grad.stops);
        if (stops.length < 1) return out;
        var css = gradToCss(stops, grad.angle);
        if (!css) return out;

        out['bl-grad-page'] = css;
        out['bl-grad-soft'] = gradToCss(stops.map(function (x) {
            var c = hexToRgb(x.color);
            var H = rgbToHsl(c.r, c.g, c.b);
            /* 柔和版：浅色提亮降饱和，深色压暗降饱和 */
            return { color: hslCss(H.h, Math.min(H.s, 34), dark ? 16 : 94), pos: x.pos };
        }), grad.angle);
        out['bl-grad-base'] = gradAverage(stops);

        /* 半透明强度：面板类偏高（保住文字对比度），页面级背景偏低（渐变最显眼）。
           初版面板给到 0.74，实测面板叠在饱和渐变上后底色变重，
           正文对比度从 ~5.0 掉到 3.4。这里把面板提回 0.86/0.88，
           渐变主要靠 page-background 与边缘间隙体现。 */
        var aMain = dark ? '0.80' : '0.78';
        var aSoft = dark ? '0.70' : '0.68';

        /* [B114] 只让【页面级大背景】透出渐变；弹窗 / 浮层 / 输入控件专用
           底色必须保持实色。旧版把 ui-modal-background / ui-white /
           popover-background / input-background / badge-background 一起
           alphaize 成 0.78~0.80，渐变主题与自定义主题预览期间所有引用
           它们的弹窗整块透出背后的舞台与积木，而用玻璃变量的窗口不受
           影响 —— 这就是「有的弹窗会变成半透明」。 */
        out['bl-panel-solid'] = out['ui-modal-background'] || (dark ? '#1e2128' : '#ffffff');
        out['bl-panel-solid-alt'] = out['ui-secondary'] || (dark ? '#242731' : '#f2f5f9');
        var bgKeys = ['ui-primary', 'ui-secondary', 'ui-tertiary',
            'assets-background', 'page-background', 'fullscreen-background', 'fullscreen-accent'];
        for (var i = 0; i < bgKeys.length; i++) {
            var k = bgKeys[i];
            if (out[k]) out[k] = alphaize(out[k], i < 3 ? aMain : aSoft);
        }
        /* 菜单条也透一点，顶部就能看到渐变 */
        if (out['menu-bar-background']) out['menu-bar-background'] = alphaize(out['menu-bar-background'], dark ? '0.84' : '0.80');
        return out;
    }

    function gradCss(state) {
        var stops = state.stops.slice().sort(function (a, b) { return a.pos - b.pos; });
        var list = stops.map(function (st) { return st.color + ' ' + st.pos + '%'; });
        return 'linear-gradient(' + state.angle + 'deg, ' + list.join(', ') + ')';
    }

    function gradAccent(state) {
        var stops = state.stops.slice().sort(function (a, b) { return a.pos - b.pos; });
        return (stops[0] && stops[0].color) || '#4c97ff';
    }

    function gradEditorHTML(state) {
        var i;
        var presetHtml = '';
        for (i = 0; i < GRAD_PRESETS.length; i++) {
            var p = GRAD_PRESETS[i];
            presetHtml += '<button type="button" class="grad-preset" data-preset="' + i + '">' +
                '<span class="grad-preset-chip" style="background:linear-gradient(90deg,' +
                p.stops.join(',') + ')"></span>' +
                '<span>' + esc(p.label) + '</span></button>';
        }
        /* 结构与原生窗口完全一致：
           addon-window-header / -title / -controls / -btn / -content。
           这样外观、拖动、贴靠、置顶全都跟原生弹窗一致
           （initWindows 的拖动逻辑就是按 .addon-window-header 找的）。 */
        return '' +
            '<div class="addon-window grad-win">' +
            '<div class="addon-window-header">' +
            '<span class="addon-window-title">自定义主题色</span>' +
            '<div class="addon-window-controls">' +
            '<button type="button" class="addon-window-btn addon-window-btn-minimize grad-min" title="最小化" aria-label="最小化">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<line x1="5" y1="12" x2="19" y2="12"/></svg></button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-maximize grad-max" title="最大化" aria-label="最大化">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<rect class="grad-max-i" x="5" y="5" width="14" height="14" rx="2"/></svg></button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-close grad-close" title="关闭" aria-label="关闭">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>' +
            '</div></div>' +
            '<div class="addon-window-content grad-body">' +
            '<div class="grad-col grad-col-left">' +
            '<div class="grad-sec-title">主题详情</div>' +
            '<label class="grad-field"><span>名称</span>' +
            '<input type="text" class="grad-input" data-field="name" value="' + esc(state.name) + '" /></label>' +
            '<label class="grad-field"><span>描述</span>' +
            '<input type="text" class="grad-input" data-field="desc" value="' + esc(state.desc) + '" /></label>' +
            '<div class="grad-sec-title">快速预设</div>' +
            '<div class="grad-presets">' + presetHtml + '</div>' +
            '</div>' +
            '<div class="grad-col grad-col-right">' +
            '<div class="grad-sec-title">渐变</div>' +
            '<div class="grad-bar" data-role="bar">' +
            '<div class="grad-bar-fill" data-role="fill"></div>' +
            '<div class="grad-handles" data-role="handles"></div>' +
            '</div>' +
            '<div class="grad-tools">' +
            '<button type="button" class="grad-btn" data-act="add">添加颜色</button>' +
            '<button type="button" class="grad-btn" data-act="dup">复制</button>' +
            '<button type="button" class="grad-btn" data-act="del">删除</button>' +
            '<label class="grad-picker">色标颜色' +
            '<input type="color" class="grad-color" data-role="color" value="' + esc(state.stops[state.sel] ? state.stops[state.sel].color : '#ffffff') + '" />' +
            '</label>' +
            '</div>' +
            '<div class="grad-row"><span class="grad-label">方向</span>' +
            '<input type="range" class="grad-range" data-role="angle" min="0" max="360" step="1" value="' + state.angle + '" />' +
            '<span class="grad-value" data-role="angleVal">' + state.angle + '&deg;</span></div>' +
            '<div class="grad-row"><span class="grad-label">明暗</span>' +
            '<div class="grad-seg">' +
            '<button type="button" class="grad-seg-btn' + (state.dark ? '' : ' is-on') + '" data-act="light">浅色</button>' +
            '<button type="button" class="grad-seg-btn' + (state.dark ? ' is-on' : '') + '" data-act="dark">深色</button>' +
            '</div></div>' +
            '<div class="grad-row"><span class="grad-label">主色调</span>' +
            '<span class="grad-value grad-accent" data-role="accent">' + esc(gradAccent(state)) + '</span></div>' +
            '<div class="grad-preview" data-role="preview"></div>' +
            '</div>' +
            '</div>' +
            '<div class="grad-foot">' +
            '<button type="button" class="grad-btn grad-btn-main" data-act="preview">预览主题</button>' +
            '<span class="grad-spacer"></span>' +
            '<button type="button" class="grad-btn" data-act="cancel">取消</button>' +
            '<button type="button" class="grad-btn grad-btn-primary" data-act="create">创建</button>' +
            '</div>' +
            '</div>';
    }

    function renderGrad() {
        if (!gradWin || !gradState) return;
        var st = gradState;
        var q = function (sel) { return gradWin.querySelector(sel); };

        var fill = q('[data-role="fill"]');
        if (fill) fill.style.background = gradCss(st);

        var handles = q('[data-role="handles"]');
        if (handles) {
            var html = '';
            for (var i = 0; i < st.stops.length; i++) {
                html += '<span class="grad-handle' + (i === st.sel ? ' is-sel' : '') + '"' +
                    ' data-stop="' + i + '" style="left:' + st.stops[i].pos + '%;background:' +
                    esc(st.stops[i].color) + '" title="' + esc(st.stops[i].color) + '"></span>';
            }
            handles.innerHTML = html;
        }

        var color = q('[data-role="color"]');
        if (color && st.stops[st.sel]) color.value = st.stops[st.sel].color;

        var av = q('[data-role="angleVal"]');
        if (av) av.innerHTML = st.angle + '&deg;';

        var acc = q('[data-role="accent"]');
        if (acc) acc.textContent = gradAccent(st);

        var prev = q('[data-role="preview"]');
        if (prev) {
            var a = hexToRgb(gradAccent(st));
            var H = rgbToHsl(a.r, a.g, a.b);
            var base = st.dark ? hslCss(H.h, 18, 13) : hslCss(H.h, 42, 97);
            var fg = st.dark ? hslCss(H.h, 12, 92) : hslCss(H.h, 40, 26);
            prev.style.background = base;
            prev.style.color = fg;
            prev.innerHTML = '<div class="grad-prev-bar" style="background:' + gradCss(st) + '"></div>' +
                '<div class="grad-prev-text">' + esc(st.name || '未命名') +
                '<span>' + esc(st.desc || '') + '</span></div>';
        }
    }

    function closeGradEditor(restore) {
        if (!gradWin) return;
        dockForget('grad');
        if (restore && gradState && gradState.prev) {
            try { applyTheme(gradState.prev, true, true); } catch (e) { /* ignore */ }
        }
        /* 预览用的临时主题不保留，避免留在 THEMES 里影响后续渲染 */
        try { delete THEMES[PREVIEW_ID]; delete WORKSPACE[PREVIEW_ID]; } catch (e) { /* ignore */ }
        var w = gradWin;
        gradWin = null;
        gradState = null;
        popOut(w, function () {
            if (w && w.parentNode) w.parentNode.removeChild(w);
        });
    }

    /* 最小化 / 最大化前的尺寸位置，用于还原 */
    var gradRect = null;

    function gradIsMax() {
        return !!(gradWin && gradWin.classList.contains('grad-window-maximized'));
    }

    function gradSetMin(on) {
        if (!gradWin) return;
        if (on) {
            /* 收进 DOCK：窗口整个隐藏，DOCK 上出现图标，点图标放回原位 */
            if (dockMinimize(gradWin, {
                id: 'grad', label: '自定义主题',
                svg: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>'
            })) return;
            if (!gradRect) {
                gradRect = {
                    left: gradWin.style.left, top: gradWin.style.top,
                    width: gradWin.style.width, height: gradWin.style.height
                };
            }
            gradWin.classList.add('grad-window-minimized');
            gradWin.style.width = '300px';
            gradWin.style.height = '';
        } else {
            gradWin.classList.remove('grad-window-minimized');
            if (gradRect) {
                gradWin.style.left = gradRect.left;
                gradWin.style.top = gradRect.top;
                gradWin.style.width = gradRect.width;
                gradWin.style.height = gradRect.height;
                gradRect = null;
            }
        }
    }

    function gradSetMax(on) {
        if (!gradWin) return;
        if (on) {
            if (!gradRect) {
                gradRect = {
                    left: gradWin.style.left, top: gradWin.style.top,
                    width: gradWin.style.width, height: gradWin.style.height
                };
            }
            gradWin.classList.add('grad-window-maximized');
            gradWin.classList.remove('grad-window-minimized');
            gradWin.style.left = '0px';
            gradWin.style.top = '0px';
            gradWin.style.width = '100vw';
            gradWin.style.height = '100vh';
        } else {
            gradWin.classList.remove('grad-window-maximized');
            if (gradRect) {
                gradWin.style.left = gradRect.left;
                gradWin.style.top = gradRect.top;
                gradWin.style.width = gradRect.width;
                gradWin.style.height = gradRect.height;
                gradRect = null;
            }
        }
        /* 与原生窗口管理器一致：最大化时按钮类名从 maximize 换成 restore，
           否则切到 macOS / Windows 10 皮肤后按钮外观会和原版窗口不一致。 */
        (function () {
            var b = gradWin ? gradWin.querySelector('.grad-max') : null;
            if (!b) return;
            b.classList.toggle('addon-window-btn-restore', !!on);
            b.classList.toggle('addon-window-btn-maximize', !on);
            b.setAttribute('title', on ? '还原' : '最大化');
            b.setAttribute('aria-label', on ? '还原' : '最大化');
        })();
        var ico = gradWin.querySelector('.grad-max-i');
        if (ico) {
            /* 最大化时图标切成"还原"（两个错开的方框） */
            if (on) {
                ico.setAttribute('x', '4'); ico.setAttribute('y', '8');
                ico.setAttribute('width', '12'); ico.setAttribute('height', '12');
            } else {
                ico.setAttribute('x', '5'); ico.setAttribute('y', '5');
                ico.setAttribute('width', '14'); ico.setAttribute('height', '14');
            }
        }
    }

    function openGradientEditor() {
        closeGradEditor(false);
        gradState = defaultGradState();
        gradState.prev = currentTheme;
        gradRect = null;

        var host = blTopLayer();
        var win = document.createElement('div');
        win.innerHTML = gradEditorHTML(gradState);
        gradWin = win.firstChild;

        /* 位置尺寸写在 style 上（与原生一致），居中偏上一点避开菜单栏。
           ⚠ position 必须显式设置：原生 .addon-window 类里不含 position，
           全靠各窗口自己写（油猴窗口也是这么做的）。之前漏了这一项，
           窗口就是 static —— left/top 被完全忽略，拖动每帧改坐标却纹丝不动。 */
        var w = Math.min(680, Math.max(320, window.innerWidth - 48));
        var h = Math.min(560, Math.max(320, window.innerHeight - 64));
        gradWin.style.position = 'fixed';
        gradWin.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
        gradWin.style.top = Math.round(Math.max(24, (window.innerHeight - h) / 2 - 20)) + 'px';
        gradWin.style.width = w + 'px';
        gradWin.style.height = h + 'px';
        gradWin.style.zIndex = '20';

        host.appendChild(gradWin);
        gradWin.__blPopMs = 240; gradWin.__blExitMs = 180;
        popIn(gradWin);
        bringWindowToFront(gradWin);

        var q = function (sel) { return gradWin.querySelector(sel); };

        /* 窗口控制：最小化 / 最大化 / 关闭 */
        var gm = q('.grad-min');
        var gx = q('.grad-max');
        if (gm) gm.addEventListener('click', function () { gradSetMin(true); });
        if (gx) gx.addEventListener('click', function () { gradSetMax(!gradIsMax()); });
        /* 点窗口任意处置顶，避免被其它窗口压住 */
        gradWin.addEventListener('pointerdown', function () { bringWindowToFront(gradWin); });

        /* --- 输入 --- */
        var nameI = q('[data-field="name"]');
        var descI = q('[data-field="desc"]');
        if (nameI) nameI.addEventListener('input', function () {
            gradState.name = nameI.value; renderGrad();
        });
        if (descI) descI.addEventListener('input', function () {
            gradState.desc = descI.value; renderGrad();
        });

        var colorI = q('[data-role="color"]');
        if (colorI) colorI.addEventListener('input', function () {
            if (gradState.stops[gradState.sel]) {
                gradState.stops[gradState.sel].color = colorI.value;
                renderGrad();
            }
        });

        var angleI = q('[data-role="angle"]');
        if (angleI) angleI.addEventListener('input', function () {
            gradState.angle = parseInt(angleI.value, 10) || 0;
            renderGrad();
        });

        /* --- 色标拖动 --- */
        var bar = q('[data-role="bar"]');
        var dragging = null;
        if (bar) {
            bar.addEventListener('pointerdown', function (e) {
                var h = e.target && e.target.closest ? e.target.closest('.grad-handle') : null;
                if (h) {
                    dragging = parseInt(h.getAttribute('data-stop'), 10);
                    gradState.sel = dragging;
                    renderGrad();
                    try { bar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                    e.preventDefault();
                    return;
                }
                /* 点空白处：就近插入一个色标 */
                var r = bar.getBoundingClientRect();
                var pos = clampN(((e.clientX - r.left) / r.width) * 100, 0, 100);
                var idx = nearestStop(pos);
                gradState.stops.splice(idx + 1, 0, {
                    color: colorAtPos(pos), pos: Math.round(pos)
                });
                gradState.sel = idx + 1;
                renderGrad();
            });
            bar.addEventListener('pointermove', function (e) {
                if (dragging == null) return;
                var r = bar.getBoundingClientRect();
                var pos = clampN(((e.clientX - r.left) / r.width) * 100, 0, 100);
                gradState.stops[dragging].pos = Math.round(pos);
                renderGrad();
            });
            var stopDrag = function () { dragging = null; };
            bar.addEventListener('pointerup', stopDrag);
            bar.addEventListener('pointercancel', stopDrag);
        }

        /* --- 按钮 --- */
        gradWin.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            /* 关闭按钮已改成原生窗口结构里的 .grad-close，不再带 data-act */
            var closeBtn = t.closest('.grad-close') || t.closest('[data-act="close"]');
            if (closeBtn) { closeGradEditor(true); return; }

            var pr = t.closest('[data-preset]');
            if (pr) {
                var gi = parseInt(pr.getAttribute('data-preset'), 10);
                var p = GRAD_PRESETS[gi];
                if (p) {
                    gradState.stops = p.stops.map(function (c, i) {
                        return { color: c, pos: Math.round(i * 100 / (p.stops.length - 1)) };
                    });
                    gradState.sel = 0;
                    renderGrad();
                }
                return;
            }

            var actBtn = t.closest('[data-act]');
            if (!actBtn) return;
            var act = actBtn.getAttribute('data-act');

            if (act === 'add') {
                var last = gradState.stops[gradState.stops.length - 1];
                var pos = Math.min(100, (last ? last.pos : 0) + 20);
                gradState.stops.push({ color: last ? last.color : '#ffffff', pos: Math.round(pos) });
                gradState.sel = gradState.stops.length - 1;
                renderGrad();
            } else if (act === 'dup') {
                var cur = gradState.stops[gradState.sel];
                if (cur) {
                    gradState.stops.splice(gradState.sel + 1, 0, {
                        color: cur.color, pos: Math.min(100, cur.pos + 10)
                    });
                    gradState.sel += 1;
                    renderGrad();
                }
            } else if (act === 'del') {
                if (gradState.stops.length > 2) {
                    gradState.stops.splice(gradState.sel, 1);
                    gradState.sel = Math.max(0, gradState.sel - 1);
                    renderGrad();
                }
            } else if (act === 'light' || act === 'dark') {
                gradState.dark = (act === 'dark');
                var segs = gradWin.querySelectorAll('.grad-seg-btn');
                for (var i = 0; i < segs.length; i++) {
                    segs[i].classList.toggle('is-on', segs[i].getAttribute('data-act') === act);
                }
                renderGrad();
            } else if (act === 'preview') {
                applyPreview();
            } else if (act === 'cancel') {
                closeGradEditor(true);
            } else if (act === 'create') {
                createFromEditor();
            }
        });

        renderGrad();
    }

    function nearestStop(pos) {
        var best = 0, bd = 1e9;
        for (var i = 0; i < gradState.stops.length; i++) {
            var d = Math.abs(gradState.stops[i].pos - pos);
            if (d < bd) { bd = d; best = i; }
        }
        return best;
    }

    /* 在渐变条上取色：用于在空白处插入色标时给出合理的初始颜色 */
    function colorAtPos(pos) {
        var stops = gradState.stops.slice().sort(function (a, b) { return a.pos - b.pos; });
        if (!stops.length) return '#4c97ff';
        if (pos <= stops[0].pos) return stops[0].color;
        var last = stops[stops.length - 1];
        if (pos >= last.pos) return last.color;
        for (var i = 0; i < stops.length - 1; i++) {
            if (pos >= stops[i].pos && pos <= stops[i + 1].pos) {
                var span = stops[i + 1].pos - stops[i].pos;
                var t = span > 0 ? (pos - stops[i].pos) / span : 0;
                return mixHex(stops[i].color, stops[i + 1].color, t);
            }
        }
        return last.color;
    }

    /* 预览：用一个临时 id 注册并应用，避免污染存储 */
    var PREVIEW_ID = '__bl_preview__';

    function applyPreview() {
        if (!gradState) return;
        var st = gradState;
        var stops = normalizeStops(st.stops.map(function (x) {
            return { color: x.color, pos: x.pos };
        }));
        var grad = { stops: stops, angle: st.angle };
        var accent = gradAccent(st);
        var base = gradBaseOf(stops, accent);
        var gui = deriveGui(base, st.dark);
        applyGradLayer(gui, grad, st.dark);
        THEMES[PREVIEW_ID] = {
            label: st.name || '预览', swatch: accent,
            rgb: rgbToHexStr(gui['ui-primary']),
            blocksId: st.dark ? 'dark' : 'three', category: null, dark: st.dark,
            gui: gui, accent: accent, custom: false, group: 'custom', grad: grad
        };
        WORKSPACE[PREVIEW_ID] = deriveWorkspaceWithGrad(base, st.dark, grad);
        try { applyTheme(PREVIEW_ID, true, true); } catch (e) { /* ignore */ }
    }

    /* 渐变基色：取平均色；若多色相混出发灰的结果，退回主色标保住色感 */
    function gradBaseOf(stops, fallback) {
        if (!stops || !stops.length) return fallback || '#4c97ff';
        var avg = gradAverage(stops);
        var c = hexToRgb(avg);
        var H = rgbToHsl(c.r, c.g, c.b);
        return H.s < 8 ? (fallback || avg) : avg;
    }

    function createFromEditor() {
        if (!gradState) return;
        var st = gradState;
        var accent = gradAccent(st);
        var id = 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
        /* 位置信息必须一起存：只存颜色数组的话渐变会退化成等距分布，
           用户调好的疏密关系全没了。 */
        var stops = normalizeStops(st.stops.map(function (x) {
            return { color: x.color, pos: x.pos };
        }));
        var grad = { stops: stops, angle: st.angle };
        var name = (st.name || '').trim() || '我的渐变主题';
        var base = gradBaseOf(stops, accent);

        try { delete THEMES[PREVIEW_ID]; delete WORKSPACE[PREVIEW_ID]; } catch (e) { /* ignore */ }

        saveCustomTheme(id, name, st.desc || '', base, st.dark, gradToCss(stops, st.angle), grad);
        rebuildPanel();
        closeGradEditor(false);
        try { applyTheme(id, true, true); } catch (e) { /* ignore */ }
    }

    /* 文档级委托：React 把菜单栏整体换掉也不会丢点击。
       捕获阶段处理，主题按钮的 click 不会漏给别的处理器，
       面板内的点击也不会误触发「点外部关闭」。 */
    function installDelegates() {
        if (delegatesInstalled) return;
        delegatesInstalled = true;
        /* [B108] 鼠标移到「主题色」按钮即弹出，不需要点击。
           移到面板内取消待关闭的计时；移出按钮且不在面板内时延迟收起。 */
        document.addEventListener('mouseover', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.tw-theme-btn')) {
                if (!panelOpen) openPanel();
                cancelClose();
            } else if (panelOpen && panelEl && panelEl.contains(t)) {
                cancelClose();
            }
        }, true);
        document.addEventListener('mouseout', function (e) {
            var t = e.target;
            if (!t || !t.closest || !t.closest('.tw-theme-btn')) return;
            var to = e.relatedTarget;
            if (to && panelEl && panelEl.contains(to)) return;
            if (to && to.closest && to.closest('.tw-theme-btn')) return;
            if (panelOpen) scheduleClose();
        }, true);
        document.addEventListener('click', function (e) {
            var t = e.target;
            var btn = t && t.closest ? t.closest('.tw-theme-btn') : null;
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                /* 点击只负责打开；收起交给「移出 + 延迟」或 Esc / 点外部 */
                if (!panelOpen) openPanel();
                return;
            }
            if (!panelOpen) return;
            if (rootEl && rootEl.contains(t)) return;
            if (panelEl && panelEl.contains(t)) return;
            /* 自定义主题编辑器是独立窗口，点它不关面板 */
            closePanel();
        }, true);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closePanel(); return; }
            var t = e.target;
            if ((e.key === 'Enter' || e.key === ' ') && t && t.closest &&
                t.closest('.tw-theme-btn')) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel();
            }
        }, true);
    }

    function mount() {
        var bar = document.querySelector('[class*="menu-bar_main-menu_"]');
        if (!bar) return false;
        /* 若 React 只换了子节点、已经存在另一个根节点，直接接管它，
           不要留着旧引用（旧引用已 detached，positionPanel 会算错位置）。 */
        var existing = bar.querySelector('.tw-theme-root');
        if (existing) {
            if (existing !== rootEl) {
                rootEl = existing;
                themeBtn = existing.querySelector('.tw-theme-btn');
            }
            installDelegates();
            return true;
        }

        rootEl = document.createElement('div');
        rootEl.className = 'tw-theme-root';
        rootEl.innerHTML =
            '<div class="menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB tw-theme-btn"' +
            ' role="button" tabindex="0" aria-label="切换主题色" title="切换主题色">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>' +
            '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"></path></svg>' +
            '<span>主题色</span></div>';

        bar.appendChild(rootEl);
        var btn = rootEl.querySelector('.tw-theme-btn');
        themeBtn = btn;

        installDelegates();
        window.addEventListener('resize', function () {
            if (panelOpen) positionPanel();
        });

        return true;
    }

    /* ================================================================== *
     * 右键菜单中的「搜索」
     * ================================================================== */

    var searchBox = null, searchInput = null, searchList = null;
    var lastResults = [];
    var lastNeedle = '';
    var activeIndex = -1;

    /* 搜索范围分类。
       以前只有"积木"，现在按编辑器里的实体类型分六类，
       全部 = 六类一起搜（各自独立匹配，再按分类顺序排列）。 */
    var SEARCH_CATS = [
        { id: 'all', label: '全部' },
        { id: 'block', label: '积木' },
        { id: 'sprite', label: '角色' },
        { id: 'var', label: '变量' },
        { id: 'comment', label: '注释' }
    ];
    var searchCat = 'all';
    var SEARCH_LIMIT = 300;

    function ensureSearchBox() {
        if (searchBox) return searchBox;
        searchBox = document.createElement('div');
        searchBox.className = 'bl-search-box';
        searchBox.innerHTML =
            '<div class="bl-search-head">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"></circle>' +
            '<path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>' +
            '</svg>' +
            '<input class="bl-search-input" type="text" autocomplete="off" ' +
            'placeholder="搜索积木、角色、变量、注释…" />' +
            '<button type="button" class="bl-search-close" aria-label="关闭">&times;</button>' +
            '</div>' +
            '<div class="bl-search-tabs">' +
            (function () {
                var h = '', i;
                for (i = 0; i < SEARCH_CATS.length; i++) {
                    h += '<button type="button" class="bl-search-tab' +
                        (SEARCH_CATS[i].id === searchCat ? ' is-on' : '') +
                        '" data-cat="' + SEARCH_CATS[i].id + '">' +
                        SEARCH_CATS[i].label + '</button>';
                }
                return h;
            })() +
            '</div>' +
            '<div class="bl-search-list"></div>' +
            '<div class="bl-search-foot">' +
            '<button type="button" class="bl-search-act" data-act="select">' +
            '<span>选择</span><kbd>Enter</kbd></button>' +
            '<button type="button" class="bl-search-act" data-act="expand">' +
            '<span>展开</span><kbd>Ctrl+E</kbd></button>' +
            '<button type="button" class="bl-search-act" data-act="run">' +
            '<span>运行</span><kbd>Alt+R</kbd></button>' +
            '<button type="button" class="bl-search-act" data-act="goto">' +
            '<span>跳过去</span><kbd>Shift+Enter</kbd></button>' +
            '</div>';
        /* 挂 body 而不是顶层宿主：宿主 position:fixed + z-index 自成层叠上下文，
           子元素的 z-index 出不去，会被抬到 999999 的原版窗口整块压住。
           见 inject.css 里 .bl-search-box 的 z-index 说明。 */
        (document.body || document.documentElement).appendChild(searchBox);
        searchInput = searchBox.querySelector('.bl-search-input');
        searchList = searchBox.querySelector('.bl-search-list');

        searchBox.querySelector('.bl-search-tabs').addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('.bl-search-tab') : null;
            if (!b) return;
            searchCat = b.getAttribute('data-cat') || 'all';
            var ts = searchBox.querySelectorAll('.bl-search-tab');
            for (var i = 0; i < ts.length; i++) {
                ts[i].classList.toggle('is-on', ts[i] === b);
            }
            runSearch(searchInput ? searchInput.value : '');
            try { searchInput.focus(); } catch (err) { /* ignore */ }
        });

        searchBox.querySelector('.bl-search-foot').addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('.bl-search-act') : null;
            if (!b) return;
            var act = b.getAttribute('data-act');
            if (act === 'select') selectResult(activeIndex, false);
            else if (act === 'goto') selectResult(activeIndex, true);
            else if (act === 'expand') expandResult(activeIndex);
            else if (act === 'run') runResult(activeIndex);
        });

        /* 边打边搜：不依赖回车，避免"回车没生效"这类体验问题 */
        var searchDebounce = 0;
        searchInput.addEventListener('input', function () {
            window.clearTimeout(searchDebounce);
            searchDebounce = window.setTimeout(function () {
                runSearch(searchInput.value);
            }, 180);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (activeIndex >= 0 && lastResults[activeIndex]) {
                    /* Shift+Enter 是跳过去：定位但不关搜索框，便于连着看几条 */
                    selectResult(activeIndex, !!e.shiftKey);
                } else runSearch(searchInput.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeSearch();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!lastResults.length) return;
                e.preventDefault();
                e.stopPropagation();
                activeIndex += (e.key === 'ArrowDown' ? 1 : -1);
                if (activeIndex < 0) activeIndex = lastResults.length - 1;
                if (activeIndex >= lastResults.length) activeIndex = 0;
                highlightResult();
            } else if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                expandResult(activeIndex);
            } else if (e.key === 'r' && e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                runResult(activeIndex);
            }
        });
        searchBox.querySelector('.bl-search-close').addEventListener('click', closeSearch);
        searchList.addEventListener('click', function (e) {
            var item = e.target && e.target.closest ? e.target.closest('.bl-search-item') : null;
            if (item) selectResult(Number(item.getAttribute('data-index')), false);
        });
        searchList.addEventListener('dblclick', function (e) {
            var item = e.target && e.target.closest ? e.target.closest('.bl-search-item') : null;
            if (item) selectResult(Number(item.getAttribute('data-index')), true);
        });
        searchBox.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        searchBox.addEventListener('contextmenu', function (e) { e.stopPropagation(); });
        searchBox.addEventListener('keydown', function (e) { e.stopPropagation(); }, true);
        document.addEventListener('pointerdown', function (e) {
            if (!searchBox || !searchBox.classList.contains('is-open')) return;
            if (searchBox.contains(e.target)) return;
            /* 刚打开的一瞬间不响应"点到外面"：
               召唤搜索框的那一次点击（右键菜单里的项）如果晚于 open 到达，
               会把刚打开的框立刻关掉 —— 用户看到的就是"显示一瞬间就消失"。
               400ms 内一律不关，足够吃掉任何迟到的同一次手势。 */
            if (Date.now() - searchOpenedAt < 400) return;
            /* 触发它的右键菜单本身也不算"外面" */
            if (e.target && e.target.closest && e.target.closest('.blocklyContextMenu')) return;
            closeSearch();
        }, true);
        return searchBox;
    }

    /* 关闭是异步的：popOut 播完动画（还有 240ms 兜底定时器）才摘 is-open。
       如果在这段窗口里又打开了搜索框，那次迟到的回调会把"新打开的"关掉 ——
       表现就是"闪一下就没了"。用代号让旧回调自己失效。 */
    var searchGen = 0;
    var searchOpenedAt = 0;
    var searchGuard = 0;        /* 自愈守护的定时器 */
    var searchUserClosed = false;

    /* 打开后守一段时间：is-open 若被别处的逻辑意外摘掉，立刻补回来。
       用户自己关的（closeSearch）会置 searchUserClosed，守护随即退出，
       不会变成"关不掉"。 */
    function guardSearch() {
        if (searchGuard) window.clearInterval(searchGuard);
        var until = Date.now() + 1800;
        searchGuard = window.setInterval(function () {
            if (Date.now() > until || searchUserClosed || !searchBox) {
                window.clearInterval(searchGuard);
                searchGuard = 0;
                return;
            }
            if (!searchBox.classList.contains('is-open')) {
                searchBox.classList.add('is-open');
                try {
                    searchBox.style.opacity = '';
                    searchBox.style.transform = '';
                } catch (e) { /* ignore */ }
            }
        }, 150);
    }

    function openSearch(x, y) {
        var box = ensureSearchBox();
        /* 可能被别处摘成了孤儿（宿主被清理 / 被搬走），补回 body 直属 */
        var host = document.body || document.documentElement;
        if (!box.parentNode || box.parentNode !== host) host.appendChild(box);
        searchGen++;
        searchOpenedAt = Date.now();
        searchUserClosed = false;
        /* 上一次关闭留下的 forwards 动画会把 opacity 钉在 0：
           新的 fill:none 动画一结束，元素就回落到旧动画的 0 —— 表现同样是
           "弹出来一下又没了"。这里先把残留动画全部取消。 */
        try {
            if (box.getAnimations) {
                var as = box.getAnimations();
                for (var ai = 0; ai < as.length; ai++) {
                    try { as[ai].cancel(); } catch (e2) { /* ignore */ }
                }
            }
        } catch (e3) { /* ignore */ }
        box.classList.add('is-open');
        guardSearch();
        popIn(box);
        var vw = window.innerWidth || document.documentElement.clientWidth || 0;
        var vh = window.innerHeight || document.documentElement.clientHeight || 0;
        /* 加了分类页签和底部操作栏，比原来高一截，夹取范围要跟着改，
           否则搜索框会被按到屏幕外、只能看到半个头 */
        box.style.left = Math.max(8, Math.min(x, vw - 376)) + 'px';
        box.style.top = Math.max(8, Math.min(y, vh - 478)) + 'px';
        searchInput.value = '';
        searchList.innerHTML = '';
        try { searchInput.focus(); } catch (e) { /* ignore */ }
    }

    function closeSearch() {
        if (!searchBox || !searchBox.classList.contains('is-open')) return;
        searchUserClosed = true;         /* 用户主动关的，守护不要再补回来 */
        var gen = searchGen;
        popOut(searchBox, function () {
            if (gen !== searchGen) return;      /* 期间又打开了，别关新的 */
            if (searchBox) searchBox.classList.remove('is-open');
        });
    }

    /* 归一化：去掉所有空白再比较，这样 "移动 10 步" 也能命中 "移动10步" */
    function norm(s) {
        return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
    }

    function safeColour(value) {
        return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '';
    }

    /* 给"只有类型、没有实体"的结果取色：先看积木定义，再退回分类色 */
    function colourForType(type, catId) {
        try {
            var NS = window.ScratchBlocks || window.Blockly;
            var def = NS && NS.Blocks && NS.Blocks[type];
            var j = def && def.json;
            var c = (j && j.colour) || (def && def.colour_);
            if (typeof c === 'string' && c) return safeColour(c);
        } catch (e) { /* ignore */ }
        try {
            var colors = lastAppliedColors;
            var mapped = CATEGORY_ID_MAP[catId];
            var cc = colors && mapped && colors[mapped];
            if (cc && cc.primary) return safeColour(cc.primary);
        } catch (e2) { /* ignore */ }
        return '';
    }

    /* 策略 A：读积木 SVG 中已渲染的文字 —— 与用户屏幕上看到的完全一致 */
    function svgText(block) {
        try {
            var root = typeof block.getSvgRoot === 'function' ? block.getSvgRoot() : null;
            if (!root) return '';
            var nodes = root.querySelectorAll('text');
            var out = '';
            for (var i = 0; i < nodes.length; i++) {
                out += (nodes[i].textContent || '') + ' ';
            }
            return out;
        } catch (e) {
            return '';
        }
    }

    /* 策略 B：遍历字段取文本 —— SVG 尚未渲染时兜底 */
    function fieldText(block) {
        var parts = [];
        try {
            var inputs = block.inputList || [];
            for (var i = 0; i < inputs.length; i++) {
                var row = inputs[i] && inputs[i].fieldRow;
                if (!row) continue;
                for (var j = 0; j < row.length; j++) {
                    var f = row[j];
                    if (!f || typeof f.getText !== 'function') continue;
                    var t = f.getText();
                    if (t) parts.push(String(t));
                }
            }
        } catch (e) { /* ignore */ }
        return parts.join(' ');
    }

    /* 策略 C：字段值（下拉框、变量选择等，fieldRow 有时覆盖不到） */
    function valueText(block) {
        var parts = [];
        try {
            var inputs = block.inputList || [];
            for (var i = 0; i < inputs.length; i++) {
                var row = inputs[i] && inputs[i].fieldRow;
                if (!row) continue;
                for (var j = 0; j < row.length; j++) {
                    var f = row[j];
                    if (!f) continue;
                    var name = f.name;
                    if (!name || typeof block.getFieldValue !== 'function') continue;
                    var v = '';
                    try { v = block.getFieldValue(name); } catch (e) { v = ''; }
                    if (v) parts.push(String(v));
                }
            }
        } catch (e) { /* ignore */ }
        return parts.join(' ');
    }

    /* 策略 D：从积木定义取文案。
       scratch-blocks 的 message0 形如 "%{BKY_MOTION_MOVESTEPS} %1"，
       %{BKY_xxx} 要到 Blockly.Msg 里查。这条不依赖积木是否已渲染，
       所以那些在抽屉里还没画出来的积木也能被搜到。 */
    var defTextCache = Object.create(null);

    function resolveMsgRefs(text) {
        var NS = window.ScratchBlocks || window.Blockly;
        var Msg = NS && NS.Msg;
        if (!Msg) return String(text).replace(/%\{BKY_[^}]+\}/g, '');
        return String(text).replace(/%\{BKY_([^}]+)\}/g, function (all, key) {
            return Msg[key] != null ? String(Msg[key]) : '';
        });
    }

    function defText(type) {
        if (!type) return '';
        if (Object.prototype.hasOwnProperty.call(defTextCache, type)) return defTextCache[type];
        var out = '';
        try {
            var NS = window.ScratchBlocks || window.Blockly;
            var def = NS && NS.Blocks && NS.Blocks[type];
            var msg = def && (def.json && def.json.message0) || (def && def.message0);
            if (typeof msg === 'string' && msg) {
                out = resolveMsgRefs(msg).replace(/%\d/g, ' ');
            } else if (def && def.tooltip) {
                var tip = def.tooltip;
                if (typeof tip === 'string') out = resolveMsgRefs(tip);
                else if (tip && tip.text) out = resolveMsgRefs(tip.text);
            }
        } catch (e) { /* ignore */ }
        out = out.replace(/\s+/g, ' ').trim();
        defTextCache[type] = out;
        return out;
    }

    /* 文本清洗 —— 修掉"搜到错乱名称"的根源。
       四种策略会重复取到同一段文字（例如下拉框的"连接"会被
       svgText / fieldText / valueText 各取一次，显示成"连接 连接"）；
       而图片类下拉框（造型 / 声音）的字段值本身是一整串
       data:image/svg+xml;charset=utf-8,%3Csvg... 缩略图 URI，
       混进来就成了满屏乱码。这里统一清掉并去重。 */
    function cleanText(raw) {
        var parts = String(raw || '').split(/\s+/);
        var seen = Object.create(null), out = [], i, w, k;
        for (i = 0; i < parts.length; i++) {
            w = parts[i];
            if (!w) continue;
            /* 1) data: URI 本身（图片下拉框的字段值就是一整串缩略图 URI） */
            if (/^data:[a-z0-9+\/.-]+;/i.test(w)) continue;
            /* 2) URI 编码残留（%3C %22 %2F …）—— data URI 被空格截断后会剩下这些碎片 */
            if (/%[0-9a-f]{2}/i.test(w)) continue;
            /* 3) 超长的 base64 / assetId 片段 */
            if (/^[A-Za-z0-9+\/=_-]{28,}$/.test(w)) continue;
            k = w.toLowerCase();
            if (seen[k]) continue;
            seen[k] = 1;
            out.push(w);
        }
        return out.join(' ').trim();
    }


    function blockText(block) {
        if (!block) return '';
        var a = svgText(block);
        var b = a ? '' : fieldText(block);
        var c = valueText(block);
        var d = defText(block.type);
        var text = cleanText(a + ' ' + b + ' ' + c + ' ' + d);
        return text || String(block.type || '');
    }

    /* 主工作区（多来源，任一可用即可）。注意排除抽屉工作区。 */
    function getWorkspaces() {
        var found = [];
        var namespaces = [window.ScratchBlocks, window.Blockly];
        for (var n = 0; n < namespaces.length; n++) {
            var ns = namespaces[n];
            if (!ns) continue;
            var candidates = [];
            if (typeof ns.getMainWorkspace === 'function') candidates.push(ns.getMainWorkspace);
            if (ns.mainWorkspace) candidates.push(ns.mainWorkspace);
            for (var c = 0; c < candidates.length; c++) {
                var w = null;
                try {
                    w = typeof candidates[c] === 'function' ? candidates[c]() : candidates[c];
                } catch (e) {
                    w = null;
                }
                if (!w || typeof w.getAllBlocks !== 'function') continue;
                if (w.isFlyout) continue;
                if (found.indexOf(w) < 0) found.push(w);
            }
        }
        return found;
    }

    /* 抽屉（flyout）里当前显示的积木 */
    function flyoutBlocks(ws) {
        var out = [];
        if (!ws || typeof ws.getFlyout !== 'function') return out;
        var flyout = null;
        try { flyout = ws.getFlyout(); } catch (e) { return out; }
        if (!flyout || typeof flyout.getWorkspace !== 'function') return out;
        var fw = null;
        try { fw = flyout.getWorkspace(); } catch (e2) { return out; }
        if (!fw || typeof fw.getAllBlocks !== 'function') return out;
        try {
            var bs = fw.getAllBlocks();
            for (var i = 0; i < bs.length; i++) if (bs[i]) out.push(bs[i]);
        } catch (e3) { /* ignore */ }
        return out;
    }

    /* 当前选中的工具箱分类 id */
    function currentCategoryId(ws) {
        try {
            var tb = ws.toolbox_ ||
                (typeof ws.getToolbox === 'function' ? ws.getToolbox() : null);
            if (!tb) return '';
            var sel = tb.selectedItem_ ||
                (tb.categoryMenu_ && tb.categoryMenu_.selectedItem_) ||
                (tb.tree_ && tb.tree_.selectedItem_);
            return sel && sel.id_ ? String(sel.id_) : '';
        } catch (e) {
            return '';
        }
    }

    /* 直接解析工具箱各分类的 contents XML，抽出其中所有积木类型。
       这条不依赖积木是否渲染过 —— 抽屉里的积木往往要切到对应分类才会建出来，
       只靠"已渲染的积木"去搜，未渲染的分类就永远搜不到。 */
    function toolboxXmlTypes(ws) {
        var out = [];
        try {
            var tb = ws.toolbox_ ||
                (typeof ws.getToolbox === 'function' ? ws.getToolbox() : null);
            if (!tb) return out;
            var menu = tb.categoryMenu_ || tb.tree_ || tb;
            var cats = menu && menu.categories_;
            if (!cats || !cats.length) return out;
            for (var i = 0; i < cats.length; i++) {
                var cat = cats[i];
                if (!cat) continue;
                var contents = null;
                try {
                    contents = typeof cat.getContents === 'function' ? cat.getContents() : null;
                } catch (e) { contents = null; }
                if (!contents) continue;
                var xml = null;
                if (typeof contents === 'string') {
                    try {
                        xml = new DOMParser().parseFromString(contents, 'text/xml').documentElement;
                    } catch (e2) { xml = null; }
                } else if (contents.nodeType) {
                    xml = contents;
                }
                if (!xml) continue;
                var nodes = xml.getElementsByTagName ? xml.getElementsByTagName('block') : [];
                var catId = String(cat.id_ || '');
                for (var j = 0; j < nodes.length; j++) {
                    var t = nodes[j].getAttribute('type');
                    if (!t) continue;
                    out.push({ type: t, catId: catId });
                }
                /* contents 本身可能就是单个 block */
                if (!nodes.length && xml.nodeName === 'block' && xml.getAttribute('type')) {
                    out.push({ type: xml.getAttribute('type'), catId: catId });
                }
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    /* 切分类后抽屉要重建，轮询等它出现再定位 */
    function pollFlyoutFor(ws, type, budget) {
        var spent = 0;
        var step = 120;
        var tick = function () {
            try {
                var fbs = flyoutBlocks(ws);
                for (var i = 0; i < fbs.length; i++) {
                    if (fbs[i] && fbs[i].type === type) {
                        flashBlock(fbs[i]);
                        revealBlockInFlyout(fbs[i]);
                        return;
                    }
                }
            } catch (e) { /* ignore */ }
            spent += step;
            if (spent < budget) window.setTimeout(tick, step);
        };
        window.setTimeout(tick, step);
    }

    /* 抽屉里的积木滚到可见位置（抽屉没有 centerOnBlock，只能滚动容器） */
    function revealBlockInFlyout(block) {
        try {
            var root = block.getSvgRoot();
            if (!root) return;
            var box = root.getBoundingClientRect();
            var target = root.ownerSVGElement || (root.ownerDocument && root.ownerDocument.querySelector('svg.blocklyFlyout'));
            if (!target) return;
            var vb = target.getBoundingClientRect();
            if (!box.height || !vb.height) return;
            if (box.top >= vb.top && box.bottom <= vb.bottom) return;   /* 已可见 */
            var sv = target.querySelector('.blocklyFlyoutScrollbar');
            var scroller = target.parentNode;
            if (scroller && typeof scroller.scrollTop === 'number') {
                scroller.scrollTop += (box.top - vb.top) - vb.height / 2 + box.height / 2;
            }
        } catch (e) { /* ignore */ }
    }

    /* 抽屉里的积木没有 centerOnBlock，用闪烁高亮代替定位 */
    function flashBlock(block) {
        if (!block || typeof block.getSvgRoot !== 'function') return;
        var root = null;
        try { root = block.getSvgRoot(); } catch (e) { return; }
        if (!root || !root.classList) return;
        try {
            root.classList.add('bl-search-flash');
            window.setTimeout(function () {
                try { root.classList.remove('bl-search-flash'); } catch (e2) { /* ignore */ }
            }, 1500);
            if (root.scrollIntoView) root.scrollIntoView({ block: 'nearest' });
        } catch (e3) { /* ignore */ }
    }

    function highlightInFlyout(ws, type) {
        var bs = flyoutBlocks(ws);
        for (var i = 0; i < bs.length; i++) {
            if (bs[i] && bs[i].type === type) {
                flashBlock(bs[i]);
                return true;
            }
        }
        return false;
    }

    /* 命中的片段高亮：整段先转义，再给匹配部分套 <mark>，
       避免直接把搜索词拼进 innerHTML。 */
    function hlHtml(text, needle) {
        var s = String(text == null ? '' : text);
        var n = String(needle || '').trim();
        if (!n) return esc(s);
        var i = s.toLowerCase().indexOf(n.toLowerCase());
        if (i < 0) return esc(s);
        return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + n.length)) + '</mark>' +
            esc(s.slice(i + n.length));
    }

    /* 结果按"所属对象"分组：积木归到它所在角色名下，
       这样一搜出来就能看出这条积木属于哪个角色（图中「历史 2」「Mac 1」）。 */
    function renderResults() {
        if (!searchList) return;
        var needle = lastNeedle || '';
        var html = '', lastGroup = ' ';
        for (var k = 0; k < lastResults.length; k++) {
            var r = lastResults[k];
            var g = r.group || '';
            if (g !== lastGroup) {
                html += '<div class="bl-search-group">' + esc(g || '其它') + '</div>';
                lastGroup = g;
            }
            var dot = r.colour && r.kind === 'block'
                ? '<span class="bl-search-dot" style="background:' + r.colour + '"></span>'
                : '<span class="bl-search-dot is-' + r.kind + '"></span>';
            html += '<div class="bl-search-item" data-index="' + k + '">' + dot +
                '<span class="bl-search-text">' + hlHtml(r.title, needle) + '</span>' +
                (r.meta ? '<span class="bl-search-meta">' + esc(r.meta) + '</span>' : '') +
                '</div>';
        }
        searchList.innerHTML = html;
        highlightResult();
    }

    function highlightResult() {
        var items = searchList.querySelectorAll('.bl-search-item');
        for (var i = 0; i < items.length; i++) {
            if (i === activeIndex) items[i].classList.add('is-cursor');
            else items[i].classList.remove('is-cursor');
        }
        if (activeIndex >= 0 && items[activeIndex] && items[activeIndex].scrollIntoView) {
            try {
                items[activeIndex].scrollIntoView({ block: 'nearest' });
            } catch (e) { /* ignore */ }
        }
    }

    /* 选择 = 定位并收起搜索框；跳过去 = 只定位，框留着继续看别的 */
    function selectResult(index, keepOpen) {
        if (!lastResults[index]) return;
        activeIndex = index;
        highlightResult();
        gotoResult(lastResults[index]);
        if (!keepOpen) closeSearch();
    }

    function jumpTo(index) { selectResult(index, false); }

    /* 展开：把当前结果所在的整段脚本缩放并滚动到刚好可见 */
    function expandResult(index) {
        var res = lastResults[index];
        if (!res) return;
        var wsList = getWorkspaces();
        if (!wsList.length) return;
        var ws = wsList[0];
        if (res.kind === 'block' && res.id) {
            try {
                if (typeof ws.centerOnBlock === 'function') ws.centerOnBlock(res.id);
                /* 缩放到 100% 再看整段：放大状态下一屏装不下整条脚本 */
                if (typeof ws.zoom === 'function' && typeof ws.getScale === 'function') {
                    var sc = ws.getScale();
                    if (sc && Math.abs(sc - 1) > 0.05) ws.zoom(0, 1 / sc);
                }
                if (typeof ws.scrollBoundsIntoView === 'function') {
                    var box = resBounds(res.id, ws);
                    if (box) ws.scrollBoundsIntoView(box);
                }
            } catch (e) { /* ignore */ }
            return;
        }
        /* 非积木类：切到它所属的角色再居中该角色 */
        gotoResult(res);
    }

    function resBounds(id, ws) {
        try {
            var b = ws.getBlockById(id);
            if (!b || !b.getSvgRoot) return null;
            var root = b.getSvgRoot();
            if (!root || !root.getBoundingClientRect) return null;
            var r = root.getBoundingClientRect();
            var o = ws.getFlyout ? 0 : 0;
            return { top: r.top + o, bottom: r.bottom + o, left: r.left, right: r.right };
        } catch (e) { return null; }
    }

    /* 运行：优先"只跑这一段"，拿不到私有接口时退回跑整段帽子脚本 */
    function runResult(index) {
        var res = lastResults[index];
        if (!res) return;
        var vm = getVM();
        if (!vm || !vm.runtime) return;
        var topId = null, target = null;
        if (res.kind === 'block' && res.id) {
            var b = null;
            try {
                var wsList = getWorkspaces();
                if (wsList.length && typeof wsList[0].getBlockById === 'function') {
                    b = wsList[0].getBlockById(res.id);
                }
            } catch (e2) { b = null; }
            if (b && typeof b.getTopStackBlock === 'function') {
                var top = b.getTopStackBlock();
                if (top) topId = top.id;
            }
            if (res.targetId && vm.runtime.getTargetById) {
                try { target = vm.runtime.getTargetById(res.targetId); } catch (e3) { target = null; }
            }
        }
        if (topId && target && typeof vm.runtime._pushThread === 'function') {
            try {
                vm.runtime._pushThread(topId, target);
                vm.runtime.start();
                return;
            } catch (e4) { /* 下面退回绿旗 */ }
        }
        try { vm.start(); } catch (e5) { /* ignore */ }
        try {
            if (vm.runtime.startHats) vm.runtime.startHats('event_whenflagclicked');
        } catch (e6) { /* ignore */ }
    }

    function pushResult(results, seen, block, zone, catId) {
        if (!block || results.length >= 300) return;
        var text = blockText(block);
        var key = (zone === 'ws' ? 'w:' + block.id : 'b:' + block.type + '|' + norm(text));
        if (seen[key]) return;
        var colour = '';
        try {
            if (typeof block.getColour === 'function') colour = safeColour(block.getColour());
        } catch (e) { /* ignore */ }
        if (!colour) colour = safeColour(block.colour_);
        seen[key] = 1;
        /* 同时按类型登记：XML 层据此跳过已有实体的类型，避免同一积木列两遍 */
        seen['t:' + String(block.type || '')] = 1;
        results.push({
            id: block.id,
            type: String(block.type || ''),
            text: text,
            colour: colour,
            zone: zone,
            catId: catId || ''
        });
    }

    function matches(block, needle, needleFlat) {
        var text = blockText(block);
        if (text.toLowerCase().indexOf(needle) >= 0) return true;
        if (norm(text).indexOf(needleFlat) >= 0) return true;
        return String(block.type || '').toLowerCase().indexOf(needle) >= 0;
    }

    /* ---- 各分类的数据来源 ---- */

    function targetNameById(vm, id) {
        try {
            var ts = vm.runtime.targets;
            for (var i = 0; i < ts.length; i++) if (ts[i].id === id) return ts[i].getName();
        } catch (e) { /* ignore */ }
        return '';
    }

    /* 积木属于哪个角色：scratch-vm 里每个 target 持有自己的 blocks 容器，
       逐个问过去就能确定归属，比猜工作区布局可靠。 */
    function blockOwner(vm, blockId) {
        if (!vm || !vm.runtime || !vm.runtime.targets) return '';
        var ts = vm.runtime.targets, i;
        for (i = 0; i < ts.length; i++) {
            try {
                if (ts[i].blocks && typeof ts[i].blocks.getBlock === 'function' &&
                    ts[i].blocks.getBlock(blockId)) return ts[i].id;
            } catch (e) { /* ignore */ }
        }
        return '';
    }

    function collectBlocks(results, seen, needle, needleFlat, stats) {
        var workspaces = getWorkspaces(), w, i, bs;
        var vm = getVM();
        for (w = 0; w < workspaces.length; w++) {
            try { bs = workspaces[w].getAllBlocks(); } catch (e) { continue; }
            if (!bs) continue;
            for (i = 0; i < bs.length; i++) {
                var b = bs[i];
                if (!b || b.isInsertionMarker) continue;
                /* 影子块是输入槽里的占位（数字框、下拉框），不是用户摆的积木 */
                if (typeof b.isShadow === 'function' && b.isShadow()) continue;
                stats.scanned++;
                if (!matches(b, needle, needleFlat)) continue;

                var text = blockText(b);
                var key = 'b:' + b.id;
                if (seen[key]) continue;
                seen[key] = 1;
                var colour = '';
                try {
                    if (typeof b.getColour === 'function') colour = safeColour(b.getColour());
                } catch (e2) { /* ignore */ }
                if (!colour) colour = safeColour(b.colour_);
                var tid = blockOwner(vm, b.id);
                results.push({
                    kind: 'block', id: b.id, type: String(b.type || ''),
                    title: text, colour: colour, zone: 'ws', catId: '',
                    targetId: tid, group: tid ? targetNameById(vm, tid) : '工作区',
                    meta: '积木'
                });
            }
        }
    }

    function collectSprites(results, seen, needle, stats) {
        var vm = getVM();
        if (!vm || !vm.runtime || !vm.runtime.targets) return;
        var ts = vm.runtime.targets, i, nm;
        for (i = 0; i < ts.length; i++) {
            stats.scanned++;
            nm = ts[i].getName ? ts[i].getName() : '';
            if (String(nm).toLowerCase().indexOf(needle) < 0) continue;
            var key = 's:' + ts[i].id;
            if (seen[key]) continue;
            seen[key] = 1;
            results.push({
                kind: 'sprite', id: ts[i].id, title: nm,
                meta: ts[i].isStage ? '舞台' : '角色',
                group: ts[i].isStage ? '舞台' : '角色',
                targetId: ts[i].id
            });
        }
    }

    function collectVars(results, seen, needle, stats) {
        var vm = getVM();
        if (!vm || !vm.runtime || !vm.runtime.targets) return;
        var ts = vm.runtime.targets, i, k, vars;
        for (i = 0; i < ts.length; i++) {
            vars = ts[i].variables || {};
            var nm = ts[i].getName ? ts[i].getName() : '';
            for (k in vars) {
                if (!Object.prototype.hasOwnProperty.call(vars, k)) continue;
                var v = vars[k];
                if (!v || typeof v.name !== 'string') continue;
                stats.scanned++;
                if (v.name.toLowerCase().indexOf(needle) < 0) continue;
                var key = 'v:' + ts[i].id + ':' + k;
                if (seen[key]) continue;
                seen[key] = 1;
                results.push({
                    kind: 'var', id: k, title: v.name,
                    meta: ts[i].isStage ? '变量：全局' : '变量：' + nm,
                    group: ts[i].isStage ? '全局变量' : nm,
                    targetId: ts[i].id
                });
            }
        }
    }

    function collectComments(results, seen, needle, stats) {
        var vm = getVM();
        if (!vm || !vm.runtime || !vm.runtime.targets) return;
        var ts = vm.runtime.targets, i, k, cs;
        for (i = 0; i < ts.length; i++) {
            cs = ts[i].comments || {};
            var nm = ts[i].getName ? ts[i].getName() : '';
            for (k in cs) {
                if (!Object.prototype.hasOwnProperty.call(cs, k)) continue;
                var c = cs[k];
                if (!c || typeof c.text !== 'string') continue;
                stats.scanned++;
                if (c.text.toLowerCase().indexOf(needle) < 0) continue;
                var key = 'c:' + ts[i].id + ':' + k;
                if (seen[key]) continue;
                seen[key] = 1;
                results.push({
                    kind: 'comment', id: k, title: c.text.replace(/\s+/g, ' ').trim(),
                    meta: '注释：' + nm, group: nm, targetId: ts[i].id
                });
            }
        }
    }

    var CAT_ORDER = ['block', 'sprite', 'var', 'comment'];

    function runSearch(query) {
        if (!searchList) return;
        query = String(query || '').trim();
        searchList.innerHTML = '';
        lastResults = [];
        lastNeedle = query;
        activeIndex = -1;

        if (!query) {
            searchList.innerHTML = '<div class="bl-search-empty">请输入要搜索的内容' +
                '<br><span class="bl-search-hint">可搜积木 / 角色 / 变量 / 注释</span></div>';
            return;
        }
        if (!getWorkspaces().length) {
            searchList.innerHTML = '<div class="bl-search-empty">积木区尚未就绪，请稍后再试</div>';
            return;
        }

        var needle = query.toLowerCase();
        var needleFlat = norm(query);
        var seen = Object.create(null);
        var stats = { scanned: 0 };
        var byCat = { block: [], sprite: [], var: [], comment: [] };

        if (searchCat === 'all' || searchCat === 'block') {
            collectBlocks(byCat.block, seen, needle, needleFlat, stats);
        }
        if (searchCat === 'all' || searchCat === 'sprite') collectSprites(byCat.sprite, seen, needle, stats);
        if (searchCat === 'all' || searchCat === 'var') collectVars(byCat.var, seen, needle, stats);
        if (searchCat === 'all' || searchCat === 'comment') collectComments(byCat.comment, seen, needle, stats);

        var results = [], i, k;
        for (i = 0; i < CAT_ORDER.length; i++) {
            var arr = byCat[CAT_ORDER[i]];
            for (k = 0; k < arr.length; k++) {
                if (results.length >= SEARCH_LIMIT) break;
                results.push(arr[k]);
            }
        }

        if (!results.length) {
            searchList.innerHTML = '<div class="bl-search-empty">没有找到匹配的内容' +
                '<br><span class="bl-search-hint">已扫描 ' + stats.scanned + ' 项</span></div>';
            return;
        }
        lastResults = results;
        activeIndex = 0;
        renderResults();
    }

    /* 非积木类结果：切到它所属的角色（变量/注释会顺带切到对应分类）。 */
    function gotoEntity(res) {
        var vm = getVM();
        if (!vm || !res.targetId) return;
        try {
            if (typeof vm.setEditingTarget === 'function') vm.setEditingTarget(res.targetId);
        } catch (e2) { /* ignore */ }

        if (res.kind === 'var' || res.kind === 'comment') {
            var wsList = getWorkspaces();
            if (!wsList.length) return;
            var ws = wsList[0];
            var tb = null;
            try {
                tb = ws.toolbox_ || (typeof ws.getToolbox === 'function' ? ws.getToolbox() : null);
            } catch (e3) { tb = null; }
            if (tb && typeof tb.setSelectedCategoryById === 'function') {
                /* 变量名在 Scratch 3 里归「变量」分类，不同版本 id 不同，两个都试 */
                var ids = res.kind === 'var' ? ['variables', 'data'] : ['myBlocks', 'notes'];
                for (var i = 0; i < ids.length; i++) {
                    try { tb.setSelectedCategoryById(ids[i]); break; } catch (e4) { /* ignore */ }
                }
            }
        }
    }

    function gotoResult(res) {
        if (!res) return;
        var wsList = getWorkspaces();
        if (!wsList.length) return;
        var ws = wsList[0];

        if (res.kind && res.kind !== 'block') { gotoEntity(res); return; }

        /* XML 层匹配到的是"类型"而非实体：切到它所在的分类，再按类型找出来闪烁。
           抽屉是异步重建的，单次延时经常等不到，这里轮询最多 1.5 秒。 */
        if (!res.id && res.type) {
            try {
                if (res.catId && typeof ws.getToolbox === 'function') {
                    var tb = ws.getToolbox();
                    if (tb && typeof tb.setSelectedCategoryById === 'function') {
                        tb.setSelectedCategoryById(res.catId);
                    }
                }
            } catch (e) { /* ignore */ }
            pollFlyoutFor(ws, res.type, 1500);
            return;
        }

        /* 主工作区里的积木：居中 + 高亮 */
        if (res.zone === 'ws') {
            if (res.id) {
                try {
                    if (typeof ws.centerOnBlock === 'function') ws.centerOnBlock(res.id);
                } catch (e) { /* ignore */ }
                if (typeof ws.glowBlock === 'function') {
                    try {
                        ws.glowBlock(res.id, true);
                        window.setTimeout(function () {
                            try { ws.glowBlock(res.id, false); } catch (e2) { /* ignore */ }
                        }, 1300);
                    } catch (e3) { /* ignore */ }
                }
            }
            return;
        }

        /* 抽屉里的积木：先切到它所在分类，重建后再闪烁高亮 */
        var tb = null;
        try {
            tb = ws.toolbox_ || (typeof ws.getToolbox === 'function' ? ws.getToolbox() : null);
        } catch (e) { tb = null; }
        if (res.catId && tb && typeof tb.setSelectedCategoryById === 'function') {
            try { tb.setSelectedCategoryById(res.catId); } catch (e2) { /* ignore */ }
        }
        var type = res.type;
        window.setTimeout(function () {
            if (!highlightInFlyout(ws, type)) {
                window.setTimeout(function () { highlightInFlyout(ws, type); }, 260);
            }
        }, 160);
    }

    function hookContextMenu() {
        var SB = window.ScratchBlocks;
        if (!SB || !SB.ContextMenu || typeof SB.ContextMenu.show !== 'function') return false;
        if (SB.ContextMenu.__blSearchHooked) return true;
        var original = SB.ContextMenu.show;
        SB.ContextMenu.show = function (evt, options, rtl) {
            window.setTimeout(animateContextMenu, 0);
            try {
                var list = (options && typeof options.slice === 'function') ? options.slice() : [];
                var x = (evt && typeof evt.clientX === 'number') ? evt.clientX : 0;
                var y = (evt && typeof evt.clientY === 'number') ? evt.clientY : 0;
                list.push({
                    text: '搜索',
                    enabled: true,
                    callback: function () {
                        window.setTimeout(function () { openSearch(x, y); }, 0);
                    }
                });
                options = list;
            } catch (e) { /* 包装失败时退回原始参数 */ }
            return original.call(this, evt, options, rtl);
        };
        SB.ContextMenu.__blSearchHooked = true;
        return true;
    }

    /* 右键菜单：整体弹出动画 + 菜单项错峰进入 */
    function animateContextMenu() {
        var menu = document.querySelector('.blocklyContextMenu');
        if (!menu) return;
        var items = menu.querySelectorAll('.goog-menuitem');
        for (var i = 0; i < items.length; i++) {
            items[i].style.animationDelay = (0.03 + i * 0.018).toFixed(3) + 's';
        }
    }

    /* ================================================================= *
     * 平滑滚动 / 缩放（带惯性）
     *
     * 原生的两处滚动都是"一次滚轮事件 = 一次跳变"：
     *   · 积木栏：VerticalFlyout.wheel_ 里直接 scrollbar_.set(新位置)
     *   · 积木区：WorkspaceSvg.onMouseWheel_ 里直接 scroll(新位置)
     * 滚轮事件密集时就是一格一格地跳，观感卡顿。
     * 缩放那边原来是"每次事件重启 170ms 动画"，事件一密就不断打断重启，
     * 同样是一卡一卡。
     *
     * 这里统一改成速度模型：
     *   滚轮事件 → 累加到速度（冲量）
     *   每帧     → 位移 += 速度 × dt，速度按 FRICTION 衰减
     * 于是连续滚动会平滑加速，停手后还能滑行一段再减速停下 —— 即惯性。
     * 位移到边界就把速度归零，避免撞边后继续空转。
     * ================================================================= */

    /* 关键关系：把一次滚轮的位移保持在与原生一致的总量，只是摊到多帧里。
       等比衰减的总位移 = v0 / (1 - FRICTION)，令它等于原始 delta，
       则 WHEEL_GAIN 必须等于 1 - FRICTION。
       这样滚一下移动的距离和以前一样，观感却是平滑加速 + 减速滑行。 */
    var FRICTION = 0.80;      /* 每帧（约 16.7ms）速度保留比例 */
    var WHEEL_GAIN = 0.20;    /* = 1 - FRICTION，保证总位移与原生一致 */
    var MAX_SPEED = 70;       /* 每帧最大位移，防极端输入甩太远 */
    var ZOOM_K = 0.28;        /* 缩放每帧向目标逼近的比例（对数空间） */
    var STOP_EPS = 0.15;      /* 速度低于此值即停止 */

    var reducedMotion = false;
    try {
        reducedMotion = !!(window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { /* ignore */ }

    function nowMs() {
        return (window.performance && window.performance.now) ?
            window.performance.now() : new Date().getTime();
    }

    function frameDt(now, last) {
        var dt = (now - last) / 16.6667;
        if (!(dt > 0)) dt = 1;
        if (dt > 4) dt = 4;    /* 卡顿或后台标签页时限制步长，避免瞬移 */
        return dt;
    }

    function clampSpeed(v) {
        if (v > MAX_SPEED) return MAX_SPEED;
        if (v < -MAX_SPEED) return -MAX_SPEED;
        return v;
    }

    /* ---------------- 积木栏（抽屉）纵向滚动 ---------------- */

    var flyScroll = { fly: null, pos: 0, vel: 0, raf: 0, last: 0 };

    function flyMetrics(f) {
        try { return f.getMetrics_ ? f.getMetrics_() : null; } catch (e) { return null; }
    }

    function flyCurrent(f) {
        var m = flyMetrics(f);
        if (!m) return 0;
        if (m.contentHeight != null && m.viewHeight != null) return m.viewTop - m.contentTop;
        if (m.contentWidth != null && m.viewWidth != null) return m.viewLeft - m.contentLeft;
        return 0;
    }

    function flyRange(f) {
        var m = flyMetrics(f);
        if (!m) return { min: 0, max: 0 };
        if (m.contentHeight != null && m.viewHeight != null) {
            return { min: 0, max: Math.max(0, m.contentHeight - m.viewHeight) };
        }
        return { min: 0, max: Math.max(0, m.contentWidth - m.viewWidth) };
    }

    function startFlyScroll(f, delta) {
        flyScroll.fly = f;
        if (!flyScroll.raf) {
            /* 一段新的滚动开始：以真实位置为起点，避免与拖动滚动条后的状态脱节 */
            flyScroll.pos = flyCurrent(f);
            flyScroll.vel = 0;
            flyScroll.last = nowMs();
        }
        flyScroll.vel = clampSpeed(flyScroll.vel + delta * WHEEL_GAIN);
        if (!flyScroll.raf) {
            flyScroll.raf = window.requestAnimationFrame(flyScrollStep);
        }
    }

    function flyScrollStep(now) {
        flyScroll.raf = 0;
        var f = flyScroll.fly;
        if (!f) return;
        var dt = frameDt(now, flyScroll.last);
        flyScroll.last = now;

        flyScroll.pos += flyScroll.vel * dt;
        flyScroll.vel *= Math.pow(FRICTION, dt);

        var r = flyRange(f);
        if (flyScroll.pos < r.min) { flyScroll.pos = r.min; flyScroll.vel = 0; }
        else if (flyScroll.pos > r.max) { flyScroll.pos = r.max; flyScroll.vel = 0; }

        try { if (f.scrollbar_) f.scrollbar_.set(flyScroll.pos); } catch (e) { /* ignore */ }

        if (Math.abs(flyScroll.vel) > STOP_EPS) {
            flyScroll.raf = window.requestAnimationFrame(flyScrollStep);
        } else {
            flyScroll.vel = 0;
        }
    }

    /* ---------------- 分类导航栏滚动 ----------------
       与积木栏同一套速度模型（冲量 + 逐帧衰减），手感一致。
       没溢出时返回 false 不拦截，交给原生滚动，不做无谓接管。 */

    var catScroll = { el: null, pos: 0, vel: 0, raf: 0, last: 0 };

    /* 沿指针所在元素向上找第一个真正可滚动的祖先。
       分类栏在不同版本里套的层数不一样：有时是 .scratchCategoryMenu 自己滚，
       有时是外层的 .blocklyToolboxDiv 滚。写死任一个都会在另一种结构下失效，
       所以按实际 DOM 解析，并且只在工具栏范围内往上找，别爬到工作区去。 */
    function scrollableUpInToolbox(el) {
        var e = el;
        var guard = 0;
        while (e && e !== document.body && guard++ < 14) {
            if (e.classList && e.classList.contains('blocklyToolboxDiv')) {
                if (e.scrollHeight > e.clientHeight + 2) return e;
                return null;
            }
            var oy = null;
            try { oy = getComputedStyle(e).overflowY; } catch (err) { return null; }
            if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 2) return e;
            e = e.parentElement;
        }
        return null;
    }

    function findCatScroller(at) {
        var menu = document.querySelector('.scratchCategoryMenu');
        if (menu && menu.scrollHeight > menu.clientHeight + 2) return menu;
        if (at && at.closest && at.closest('.blocklyToolboxDiv')) {
            var up = scrollableUpInToolbox(at);
            if (up) return up;
        }
        var tb = findToolbox();
        if (tb && tb.scrollHeight > tb.clientHeight + 2) return tb;
        return null;
    }

    function startCatScroll(delta, at) {
        var el = findCatScroller(at);
        if (!el) return false;
        /* 没溢出：不接管，让浏览器/编辑器自己处理 */
        if (el.scrollHeight <= el.clientHeight + 2) return false;
        catScroll.el = el;
        if (!catScroll.raf) {
            catScroll.pos = el.scrollTop;
            catScroll.vel = 0;
            catScroll.last = nowMs();
        }
        catScroll.vel = clampSpeed(catScroll.vel + delta * WHEEL_GAIN);
        if (!catScroll.raf) {
            catScroll.raf = window.requestAnimationFrame(catScrollStep);
        }
        return true;
    }

    function catScrollStep(now) {
        catScroll.raf = 0;
        var el = catScroll.el;
        if (!el) return;
        var dt = frameDt(now, catScroll.last);
        catScroll.last = now;

        catScroll.pos += catScroll.vel * dt;
        catScroll.vel *= Math.pow(FRICTION, dt);

        var max = Math.max(0, el.scrollHeight - el.clientHeight);
        if (catScroll.pos < 0) { catScroll.pos = 0; catScroll.vel = 0; }
        else if (catScroll.pos > max) { catScroll.pos = max; catScroll.vel = 0; }

        el.scrollTop = catScroll.pos;

        if (Math.abs(catScroll.vel) > STOP_EPS) {
            catScroll.raf = window.requestAnimationFrame(catScrollStep);
        } else {
            catScroll.vel = 0;
        }
    }

    /* ---------------- 积木区滚动 ---------------- */

    var wsScroll = { ws: null, x: 0, y: 0, vx: 0, vy: 0, raf: 0, last: 0,
                     cl: 0, ct: 0, mt: 0 };

    function wsMetrics(ws) {
        try { return ws.getMetrics ? ws.getMetrics() : null; } catch (e) { return null; }
    }

    function wsSyncMetrics(ws, now) {
        var m = wsMetrics(ws);
        if (m) {
            wsScroll.cl = m.contentLeft;
            wsScroll.ct = m.contentTop;
        }
        wsScroll.mt = now;
    }

    /* ⚠ WorkspaceSvg.scroll(x, y) 不能直接用于滚轮。
       它的实现是：
           var o = this.startDragMetrics;
           e = Math.min(e, -o.contentLeft) ...
           this.scrollbar.set(-e - o.contentLeft, -t - o.contentTop)
       依赖 startDragMetrics —— 而这个属性只在"拖动"流程里由
       setupDragMetrics() 赋值，滚轮滚动时它是 undefined，
       于是 scroll() 一进来就抛 "Cannot read properties of undefined
       (reading 'contentLeft')"。错误被 try/catch 吞掉，表现为
       "滚轮被我们接管并 preventDefault，但工作区纹丝不动"。
       所以自己按同样的换算走 scrollbar.set()。 */
    function wsScrollApply(ws) {
        var sb = ws.scrollbar;
        if (sb && typeof sb.set === 'function') {
            sb.set(-wsScroll.x - wsScroll.cl, -wsScroll.y - wsScroll.ct);
            return true;
        }
        try { ws.scroll(wsScroll.x, wsScroll.y); return true; }
        catch (e) { return false; }
    }

    function startWsScroll(ws, dx, dy) {
        wsScroll.ws = ws;
        if (!wsScroll.raf) {
            wsScroll.x = ws.scrollX;
            wsScroll.y = ws.scrollY;
            wsScroll.vx = 0;
            wsScroll.vy = 0;
            wsScroll.last = nowMs();
            wsSyncMetrics(ws, wsScroll.last);
        }
        wsScroll.vx = clampSpeed(wsScroll.vx + dx * WHEEL_GAIN);
        wsScroll.vy = clampSpeed(wsScroll.vy + dy * WHEEL_GAIN);
        if (!wsScroll.raf) {
            wsScroll.raf = window.requestAnimationFrame(wsScrollStep);
        }
    }

    function wsScrollStep(now) {
        wsScroll.raf = 0;
        var ws = wsScroll.ws;
        if (!ws) return;
        var dt = frameDt(now, wsScroll.last);
        wsScroll.last = now;

        /* 内容边界在滚动期间基本不变，缓存起来避免每帧遍历全部积木；
           每 250ms 刷新一次，兼顾缩放/增删积木后的正确性。 */
        if (now - wsScroll.mt > 250) wsSyncMetrics(ws, now);

        wsScroll.x += wsScroll.vx * dt;
        wsScroll.y += wsScroll.vy * dt;
        wsScroll.vx *= Math.pow(FRICTION, dt);
        wsScroll.vy *= Math.pow(FRICTION, dt);

        if (!wsScrollApply(ws)) return;
        /* set() 内部会夹取，用回读值校正，避免撞到边界后累积偏差 */
        wsScroll.x = ws.scrollX;
        wsScroll.y = ws.scrollY;

        if (Math.abs(wsScroll.vx) > STOP_EPS || Math.abs(wsScroll.vy) > STOP_EPS) {
            wsScroll.raf = window.requestAnimationFrame(wsScrollStep);
        } else {
            wsScroll.vx = 0;
            wsScroll.vy = 0;
        }
    }

    /* ---------------- 积木区缩放 ----------------
       改为"目标 + 逼近"模型：滚轮只改目标值，缩放值每帧向目标逼近。
       连续滚轮时目标不断累加，缩放平滑追赶；停手后仍会继续滑向目标再减速，
       这就是惯性。原来那种"每次事件重启定时动画"会被密集事件反复打断。 */
    var zoomState = { ws: null, target: 0, fx: 0, fy: 0, raf: 0, last: 0 };

    function patchZoom(SB) {
        var proto = SB && SB.WorkspaceSvg && SB.WorkspaceSvg.prototype;
        if (!proto || !proto.zoom || proto.__blZoomPatched) return false;
        var orig = proto.zoom;
        proto.__blZoomPatched = true;

        proto.zoom = function (x, y, delta) {
            if (!zoomAnimEnabled) return orig.apply(this, arguments);
            var opts = this.options && this.options.zoomOptions;
            if (!opts) return orig.apply(this, arguments);

            /* 焦点：缩放围绕鼠标所在的画布坐标进行 */
            var fx, fy;
            try {
                var svgPoint = this.getParentSvg().createSVGPoint();
                svgPoint.x = x;
                svgPoint.y = y;
                var focus = svgPoint.matrixTransform(this.getCanvas().getCTM().inverse());
                fx = focus.x; fy = focus.y;
            } catch (e) {
                return orig.apply(this, arguments);
            }

            var factor = Math.pow(opts.scaleSpeed, delta);
            if (!isFinite(factor) || factor <= 0) return;

            if (!zoomState.raf || zoomState.ws !== this) {
                zoomState.ws = this;
                zoomState.target = this.scale * factor;
                zoomState.last = nowMs();
            } else {
                zoomState.target = zoomState.target * factor;
            }
            if (opts.maxScale) zoomState.target = Math.min(zoomState.target, opts.maxScale);
            if (opts.minScale) zoomState.target = Math.max(zoomState.target, opts.minScale);
            zoomState.fx = fx;
            zoomState.fy = fy;

            if (!zoomState.raf) {
                zoomState.raf = window.requestAnimationFrame(zoomStep);
            }
        };
        return true;
    }

    function zoomStep(now) {
        zoomState.raf = 0;
        var ws = zoomState.ws;
        if (!ws) return;
        var dt = frameDt(now, zoomState.last);
        zoomState.last = now;

        var cur = ws.scale;
        var tgt = zoomState.target;
        if (!isFinite(cur) || !isFinite(tgt) || cur <= 0 || tgt <= 0) { return; }

        /* 在对数空间做指数逼近，结果与帧率无关 */
        var k = 1 - Math.pow(1 - ZOOM_K, dt);
        var next = cur * Math.pow(tgt / cur, k);
        if (!isFinite(next) || next <= 0) return;

        var n = next / cur;
        try {
            if (ws.scrollbar) {
                var m = ws.getMetrics();
                var ctm = ws.getCanvas().getCTM();
                if (m && ctm) {
                    var t2 = ctm.translate(zoomState.fx * (1 - n), zoomState.fy * (1 - n)).scale(n);
                    ws.scrollX = t2.e - m.absoluteLeft;
                    ws.scrollY = t2.f - m.absoluteTop;
                }
            }
            ws.setScale(next);
        } catch (e) {
            return;
        }

        /* 用对数残差判断是否收敛，避免小比例下过早停下 */
        if (Math.abs(Math.log(tgt / next)) > 0.0008) {
            zoomState.raf = window.requestAnimationFrame(zoomStep);
        }
    }

    /* ---------------- 滚轮拦截 ----------------
       在捕获阶段接管，阻止原生那次跳变，改由上面的动画驱动。 */
    /* ---------------------------------------------------------------- *
     * 判定指针究竟在谁上面
     *
     * 拖动弹窗时浏览器会做"指针捕获"，此时 e.target 被固定成拖动开始时
     * 那个元素，取不到真实位置。必须改用 elementFromPoint 实时取。
     * ---------------------------------------------------------------- */
    function elAt(x, y) {
        try { return document.elementFromPoint(x, y); } catch (e) { return null; }
    }

    function inBlocksAt(el) {
        if (!el || !el.closest) return false;
        return !!(el.closest('svg.blocklyFlyout') || el.closest('svg.blocklySvg'));
    }

    /* ---------------------------------------------------------------- *
     * 为什么还要几何判定
     *
     * 只用 elementFromPoint 时，"积木栏右侧的空地"（工作区里没有积木的
     * 空白区域）经常取不到 svg.blocklySvg：
     *   · 工作区底板 .blocklyMainBackground 是一条 rect，CSS 里只有 stroke
     *     没有 fill，fill 为空的 SVG 图元不接收指针事件；
     *   · 于是指针落在空白处时命中的是它的父容器（div.injectionDiv 之类）
     *     而不是 svg，closest('svg.blocklySvg') 判不出来。
     * 结果就是：在有积木的地方缩放正常，一挪到空地就被当成"页面缩放"。
     * 所以补一层几何判定 —— 直接看坐标是否落在积木区 / 积木栏的矩形内，
     * 空白区域也照样算，这才是"工作区"应有的范围。
     * ---------------------------------------------------------------- */
    function inRect(x, y, el) {
        if (!el || !el.getBoundingClientRect) return false;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function findFlyoutSvg() {
        return document.querySelector('svg.blocklyFlyout');
    }

    function findMainSvg() {
        return document.querySelector('svg.blocklySvg');
    }

    /* 分类导航栏（工具箱）：它是 HTML 容器，自己 overflow-y:auto 可滚动，
       而且它整块叠在 svg.blocklySvg 的矩形范围之内 —— 这正是"分类栏滚不动"
       的根源：几何兜底把指针误判成"在工作区"，于是滚轮被我们接管并
       preventDefault，滚的变成了工作区，分类栏一动不动。 */
    function findToolbox() {
        return document.querySelector('.blocklyToolboxDiv');
    }

    /* 缩放手势只在这两个区域接管；分类导航栏不算积木区，
       在那里 Ctrl+滚轮应当照常缩放页面（浏览器默认行为）。 */
    function isZoomArea(a) {
        return a === 'flyout' || a === 'workspace';
    }

    /* 返回 'flyout' / 'workspace' / 'toolbox' / 'none'，浮层直接判为 'none' 不介入 */
    function blockAreaAt(x, y) {
        var at = elAt(x, y);
        if (inOverlayAt(at)) return 'none';
        if (at && at.closest) {
            /* 分类导航栏必须在几何兜底之前就判掉，否则会被 mainSvg 矩形吃掉 */
            if (at.closest('.blocklyToolboxDiv')) return 'toolbox';
            if (at.closest('svg.blocklyFlyout')) return 'flyout';
            if (at.closest('svg.blocklySvg')) return 'workspace';
        }
        /* 几何兜底：空白区域（无 fill 的图元不接收命中）也能正确判定。
           顺序要紧 —— 先判更具体的积木栏，再排除工具箱，最后才是工作区。 */
        if (inRect(x, y, findFlyoutSvg())) return 'flyout';
        if (inRect(x, y, findToolbox())) return 'toolbox';
        if (inRect(x, y, findMainSvg())) return 'workspace';
        return 'none';
    }

    /* 浮层（弹窗 / 设置 / 模态 / 自绘窗口）内一律不介入 */
    var OVERLAY_SEL = '[class*="addon-window"], .modal-window-content,' +
        '[class*="modal-content"], [class*="modal-overlay"],' +
        '.ReactModal__Content, .ReactModal__Overlay, #bl-top-layer';

    /* 只有"真的看得见"的浮层才算遮挡。
       那些已经淡出（opacity 0 / display none / 零尺寸）却仍占着命中测试的
       残留层，会让指针明明在积木栏上却被判成"在浮层里"，于是滚轮完全不介入
       —— 表现就是"某一片区域滚不动"。 */
    function isVisibleBox(el) {
        try {
            var cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            if (parseFloat(cs.opacity) < 0.05) return false;
            var r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        } catch (e) { return true; }
    }

    function inOverlayAt(el) {
        if (!el || !el.closest) return false;
        var o = el.closest(OVERLAY_SEL);
        if (!o) return false;
        return isVisibleBox(o);
    }

    function installSmoothScroll() {
        if (installSmoothScroll.done) return;
        installSmoothScroll.done = true;

        /* ============ 滚轮 ============
           ⚠ passive 必须显式设为 false。
           Chrome 从 56 起，在 window / document / body 上注册的 wheel
           监听器默认就是 passive: true；passive 监听器里调用
           preventDefault() 会被浏览器直接忽略（控制台还会报
           "Unable to preventDefault inside passive event listener"）。
           第三参数只传 capture 布尔值是改不掉这个默认值的 ——
           必须传选项对象 { capture: true, passive: false }。
           之前正是漏了这一点：Ctrl+滚轮虽然调了 preventDefault，
           浏览器照样缩放整个页面，于是变成"界面跟着放大"。 */
        document.addEventListener('wheel', function (e) {
            if (reducedMotion) return;
            /* 正在拖动弹窗：完全不介入，拖动优先 */
            if (dragState && dragState.win) return;

            var at = elAt(e.clientX, e.clientY);
            /* 弹窗里滚鼠标：交给编辑器 / 浏览器，不抢 */
            if (inOverlayAt(at)) return;

            var SB = window.ScratchBlocks || window.Blockly;
            if (!SB) return;
            var ws = null;
            try { ws = SB.getMainWorkspace && SB.getMainWorkspace(); } catch (e0) { /* ignore */ }
            if (!ws && SB.mainWorkspace) ws = SB.mainWorkspace;
            if (!ws) return;

            /* 几何兜底：空白处也能正确判定为积木区 / 积木栏 */
            var area = blockAreaAt(e.clientX, e.clientY);
            var inBlocks = (area !== 'none');
            /* Ctrl（Windows/Linux）与 Cmd（macOS）都是浏览器缩放手势。
               只有指针确实在积木区 / 积木栏里才接管；
               在别处则完全放行，用户仍可正常缩放页面。 */
            var zoomGesture = e.ctrlKey || e.metaKey;
            /* 缩放只接管积木区/积木栏；分类导航栏上放行给浏览器缩放页面 */
            if (zoomGesture && !isZoomArea(area)) return;
            if (!inBlocks) return;

            lastBlocksHover = (typeof nowMs === 'function') ? nowMs() : Date.now();

            /* deltaMode: 0=像素 1=行 2=页，统一折算成像素 */
            var dm = 1;
            if (e.deltaMode === 1) dm = 16;
            else if (e.deltaMode === 2) dm = 100;
            var dx = (e.deltaX || 0) * dm;
            var dy = (e.deltaY || 0) * dm;

            hideFloaters(SB);

            /* ---- 缩放手势：拦下浏览器缩放，改为缩放积木 ---- */
            if (zoomGesture) {
                if (!dy) { e.preventDefault(); return; }
                var pt = { x: 0, y: 0 };
                try {
                    if (SB.utils && SB.utils.mouseToSvg) {
                        pt = SB.utils.mouseToSvg(e, ws.getParentSvg(), ws.getInverseScreenCTM());
                    } else if (e.clientX != null) {
                        var svgPt = ws.getParentSvg().createSVGPoint();
                        svgPt.x = e.clientX;
                        svgPt.y = e.clientY;
                        var f = svgPt.matrixTransform(ws.getCanvas().getCTM().inverse());
                        pt.x = f.x; pt.y = f.y;
                    }
                } catch (e1) { /* ignore */ }
                try { ws.zoom(pt.x, pt.y, -dy / 50); } catch (e2) { /* ignore */ }
                /* 关键：阻止浏览器缩放页面 */
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            /* ---- 积木栏（抽屉）滚动 ---- */
            if (area === 'flyout') {
                var fly = null;
                try { if (typeof ws.getFlyout === 'function') fly = ws.getFlyout(); } catch (e3) { /* ignore */ }
                if (fly && fly.scrollbar_) {
                    var d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
                    if (d) {
                        startFlyScroll(fly, d);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
                return;
            }

            /* ---- 分类导航栏滚动 ---- */
            if (area === 'toolbox') {
                var d2 = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
                if (d2 && startCatScroll(d2, at)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                /* 没溢出时不拦截，让原生滚动照常工作 */
                return;
            }

            /* ---- 积木区平移 ---- */
            if (e.shiftKey && !e.deltaX) {
                var tmp = dx; dx = dy; dy = 0;
            }
            if (!dx && !dy) return;
            startWsScroll(ws, -dx, -dy);
            e.preventDefault();
            e.stopPropagation();
        }, { capture: true, passive: false });

        installZoomKeys();
    }

    /* ============ 键盘缩放（Ctrl/Cmd + 加减零） ============
       同样只在指针位于积木区时接管，且焦点不在输入框里。
       否则 Ctrl+= 这类组合会被当成浏览器缩放快捷键。 */
    var lastBlocksHover = 0;

    function focusIsTyping() {
        var a = document.activeElement;
        if (!a) return false;
        var tag = (a.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || a.isContentEditable;
    }

    function zoomByStep(ws, steps) {
        try {
            var m = ws.getMetrics ? ws.getMetrics() : null;
            var cx = (m && m.viewWidth) ? m.viewLeft + m.viewWidth / 2 : 0;
            var cy = (m && m.viewHeight) ? m.viewTop + m.viewHeight / 2 : 0;
            ws.zoom(cx, cy, steps);
        } catch (e) { /* ignore */ }
    }

    function installZoomKeys() {
        if (installZoomKeys.done) return;
        installZoomKeys.done = true;

        document.addEventListener('keydown', function (e) {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (e.altKey || e.shiftKey) return;
            var k = e.key;
            var step = 0;
            if (k === '=' || k === '+' || k === 'Add') step = 1;
            else if (k === '-' || k === '_' || k === 'Subtract') step = -1;
            else if (k === '0') step = 0;
            else return;

            if (focusIsTyping()) return;
            var SB = window.ScratchBlocks || window.Blockly;
            if (!SB) return;
            var ws = null;
            try { ws = SB.getMainWorkspace && SB.getMainWorkspace(); } catch (e0) { return; }
            if (!ws) return;

            /* 指针此刻在积木区（含空白处），或最近几秒曾在积木区 */
            var ok = false;
            try {
                ok = isZoomArea(blockAreaAt(lastPointer.x, lastPointer.y));
            } catch (e1) { /* ignore */ }
            if (!ok) {
                var t = (typeof nowMs === 'function') ? nowMs() : Date.now();
                ok = !!(lastBlocksHover && (t - lastBlocksHover < 3000));
            }
            if (!ok) return;

            if (step === 0) {
                try { ws.setScale(1); } catch (e2) { /* ignore */ }
            } else {
                zoomByStep(ws, step);
            }
            e.preventDefault();
            e.stopPropagation();
        }, true);
    }

    /* 记录指针位置，供键盘缩放判定使用 */
    var lastPointer = { x: 0, y: 0 };
    document.addEventListener('pointermove', function (e) {
        lastPointer.x = e.clientX;
        lastPointer.y = e.clientY;
        try {
            if (isZoomArea(blockAreaAt(e.clientX, e.clientY))) {
                lastBlocksHover = (typeof nowMs === 'function') ? nowMs() : Date.now();
            }
        } catch (err) { /* ignore */ }
    }, { passive: true });

    function hideFloaters(SB) {
        try {
            if (SB.WidgetDiv) SB.WidgetDiv.hide(true);
            if (SB.DropDownDiv) SB.DropDownDiv.hideWithoutAnimation();
        } catch (e) { /* ignore */ }
    }

    var zoomAnimEnabled = true;

    /* ================================================================== *
     * 加载界面：进入编辑器主界面后才结束
     * ================================================================== */

    var LOADING_MAX = 8000;   /* 总超时兜底，异常时也要退出 */
    var LOADING_POLL = 60;    /* 检测间隔，越小退出越及时 */

    function isDarkStored() {
        try {
            var v = window.localStorage.getItem('bilup.appTheme');
            if (v === 'dark' || v === 'deepsea') return true;
            if (v === 'light' || v === 'sakura') return false;
            var t = window.localStorage.getItem('tw:theme');
            if (t === 'dark') return true;
            if (t === 'light') return false;
            if (t) {
                var parsed = JSON.parse(t);
                if (parsed && parsed.gui) return parsed.gui === 'dark';
            }
        } catch (e) { /* ignore */ }
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function initLoading() {
        var el = document.getElementById('blLoading');
        if (!el) return;
        if (isDarkStored()) el.setAttribute('data-theme', 'dark');

        /* 接管编辑器的 SplashEnd：原生 splash 照常隐藏，加载界面继续显示 */
        var original = window.SplashEnd;
        window.SplashEnd = function () {
            try {
                if (typeof original === 'function') original();
            } catch (e) { /* ignore */ }
            var native = document.querySelector('.spash-waiting-for-js');
            if (native) native.hidden = true;
        };

        var start = Date.now();
        var done = false;

        function finish() {
            if (done) return;
            done = true;
            /* 加载界面结束 = 首屏已成型，此时再把延后的初始化补上 */
            flushDeferred();
            /* 与独立兜底脚本共用一个入口，避免两处重复操作同一个节点 */
            if (typeof window.__blLoadingDone === 'function') {
                try {
                    window.__blLoadingDone();
                    return;
                } catch (e) { /* 兜底不可用时走下面的本地逻辑 */ }
            }
            el.classList.add('is-done');
            window.setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 460);
        }

        function uiReady() {
            /* React 已向 #app 渲染内容 */
            var app = document.getElementById('app');
            if (!app || !app.firstElementChild) return false;
            /* 编辑器主界面已成型：菜单条出现 */
            return !!document.querySelector('[class*="menu-bar_"]');
        }

        var timer = window.setInterval(function () {
            if (uiReady()) {
                window.clearInterval(timer);
                /* 两帧后收尾：既确保首屏已绘制，又比旧的 rAF+80ms 少等约 48ms */
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(finish);
                });
                return;
            }
            if (Date.now() - start > LOADING_MAX) {
                window.clearInterval(timer);
                finish();
            }
        }, LOADING_POLL);
    }

    /* ================================================================== *
     * 窗口：最大化禁止拖动 + 拖到右上角唤出贴靠面板
     * ================================================================== */

    var SNAP_ZONES = [
        { id: 'left',   label: '左半',     en: 'Left half' },
        { id: 'top',    label: '上半',     en: 'Top half' },
        { id: 'bottom', label: '下半',     en: 'Bottom half' },
        { id: 'right',  label: '右半',     en: 'Right half' },
        { id: 'tl',     label: '左上',     en: 'Top left' },
        { id: 'tr',     label: '右上',     en: 'Top right' },
        { id: 'bl',     label: '左下',     en: 'Bottom left' },
        { id: 'br',     label: '右下',     en: 'Bottom right' },
        { id: 'thirdL', label: '左 1/3',   en: 'Left third' },
        { id: 'thirdC', label: '中 1/3',   en: 'Middle third' },
        { id: 'thirdR', label: '右 1/3',   en: 'Right third' },
        { id: 'full',   label: '铺满',     en: 'Fill screen' },
        { id: 'center', label: '居中还原', en: 'Center & restore' }
    ];

    var snapPanel = null;
    var snapPreview = null;
    var dragState = null;

    function ensureSnapUI() {
        if (snapPanel) return;
        snapPanel = document.createElement('div');
        snapPanel.className = 'bl-snap';
        var html = '<div class="bl-snap-grid">';
        for (var i = 0; i < SNAP_ZONES.length; i++) {
            html += '<div class="bl-snap-zone" data-zone="' + SNAP_ZONES[i].id + '">' +
                SNAP_ZONES[i].label + '</div>';
        }
        html += '</div>';
        snapPanel.innerHTML = html;
        blTopLayer().appendChild(snapPanel);

        snapPreview = document.createElement('div');
        snapPreview.className = 'bl-snap-preview';
        blTopLayer().appendChild(snapPreview);
    }

    function zoneRect(id) {
        var W = window.innerWidth;
        var H = window.innerHeight;
        var hw = Math.floor(W / 2);
        var hh = Math.floor(H / 2);
        var tw = Math.floor(W / 3);
        switch (id) {
            case 'left':   return { x: 0, y: 0, w: hw, h: H };
            case 'right':  return { x: hw, y: 0, w: W - hw, h: H };
            case 'top':    return { x: 0, y: 0, w: W, h: hh };
            case 'bottom': return { x: 0, y: hh, w: W, h: H - hh };
            case 'tl': return { x: 0, y: 0, w: hw, h: hh };
            case 'tr': return { x: hw, y: 0, w: W - hw, h: hh };
            case 'bl': return { x: 0, y: hh, w: hw, h: H - hh };
            case 'br': return { x: hw, y: hh, w: W - hw, h: H - hh };
            case 'thirdL': return { x: 0, y: 0, w: tw, h: H };
            case 'thirdC': return { x: tw, y: 0, w: tw, h: H };
            case 'thirdR': return { x: tw * 2, y: 0, w: W - tw * 2, h: H };
            /* 铺满留 10px 边：真 100vw×100vh 会被 isMaximized() 判定为
               最大化并禁止拖动，窗口就再也拖不回右上角唤出这个面板了。 */
            case 'full': return { x: 10, y: 10, w: W - 20, h: H - 20 };
            /* 居中还原：按视口比例给一个舒适的浮窗尺寸 */
            case 'center': {
                var cw = Math.min(Math.floor(W * 0.62), 1100);
                var ch = Math.min(Math.floor(H * 0.72), 760);
                return { x: Math.floor((W - cw) / 2), y: Math.floor((H - ch) / 2),
                         w: cw, h: ch };
            }
        }
        return null;
    }

    function isMaximized(el) {
        if (!el) return false;
        if (el.style.width === '100vw' && el.style.height === '100vh') return true;
        var r = el.getBoundingClientRect();
        return Math.abs(r.width - window.innerWidth) < 3 && Math.abs(r.height - window.innerHeight) < 3;
    }

    /* ------------------------------------------------------------------ *
     * 最小化 → 收进 DOCK
     *
     * 原来的"最小化"只是把窗口缩成一条标题栏，它仍然占着屏幕、仍然叠在
     * 编辑器上，跟"收起来"是两回事。现在改成真正的收起：
     *   · 窗口隐藏（display:none），节点保留 —— 不销毁、不重建
     *   · 最小化前的位置/尺寸/最大化状态全部记下来
     *   · DOCK 里多出一个图标，点它就把窗口放回原来的位置
     *
     * DOCK 在 sea.js 里，两个模块互相独立；DOCK 万一没建起来（例如用户
     * 还没进入编辑器），这里会退化成原来的"缩成标题栏"，不会把窗口弄丢。
     * ------------------------------------------------------------------ */
    var DOCK_MIN_SVG = '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
                       '<path d="M3 10h18"/><path d="M7 14h6"/>';

    function dockTray() { return window.__blDockTray || null; }

    function dockTrayHas(id) {
        var t = dockTray();
        return !!(t && t.has && t.has(id));
    }

    function dockRemember(win) {
        if (!win) return null;
        return {
            l: win.style.left, t: win.style.top,
            w: win.style.width, h: win.style.height,
            max: win.classList.contains('bl-window-maximized') ||
                 win.classList.contains('is-max') ||
                 win.classList.contains('grad-window-maximized')
        };
    }

    function dockApplyRect(win, st) {
        if (!win || !st) return;
        if (st.max) {
            win.style.left = '0px'; win.style.top = '0px';
            win.style.width = '100vw'; win.style.height = '100vh';
            return;
        }
        if (st.l) win.style.left = st.l;
        if (st.t) win.style.top = st.t;
        if (st.w) win.style.width = st.w;
        if (st.h) win.style.height = st.h;
    }

    /* opt: { id, label, svg } */
    function dockMinimize(win, opt) {
        if (!win || !opt || !opt.id) return false;
        try { if (window.localStorage.getItem('bl:dock-hidden') === 'true') return false; } catch (e) { /* ignore */ }
        var t = dockTray();
        if (!t || !t.add) return false;          /* DOCK 不可用 → 调用方走旧逻辑 */
        win.__blDockSt = dockRemember(win);
        win.classList.add('bl-win-docked');       /* display:none，节点保留 */
        t.add({
            id: opt.id,
            label: opt.label || '窗口',
            svg: opt.svg || DOCK_MIN_SVG,
            onRestore: function () { dockRestore(win, opt); }
        });
        return true;
    }

    function dockRestore(win, opt) {
        if (!win) return;
        var t = dockTray();
        if (t && t.remove && opt && opt.id) t.remove(opt.id);
        win.classList.remove('bl-win-docked');
        /* 有些窗口（油猴）的显隐是用 style.display 管的，类去掉了还得把
           display 收回来，否则恢复后仍是一片空白 */
        if (win.style.display === 'none') win.style.display = '';
        dockApplyRect(win, win.__blDockSt);
        win.__blDockSt = null;
        bringWindowToFront(win);
        try {
            if (typeof win.animate === 'function') popIn(win);
        } catch (e) { /* ignore */ }
    }

    /* 窗口关闭时清掉托盘条目，否则 DOCK 上会留下一个点不动的幽灵图标 */
    function dockForget(id) {
        var t = dockTray();
        if (t && t.remove) t.remove(id);
    }

    /* ------------------------------------------------------------------ *
     * 原版弹窗最小化 → 收进 DOCK
     *
     * 实测原版窗口（设置、高级设置…）的最小化按钮并不是"收起"而是"关闭"：
     * 点完节点直接从 DOM 移除，再点也回不来。所以必须在捕获阶段拦下它，
     * 改成和我们自己的窗口一样收进 DOCK。
     *
     * 自己的窗口（渐变编辑器 / 油猴 / 唱片机…）各自
     * 已经绑了最小化，这里靠类名识别并放行，避免一次点击被处理两遍。
     * ------------------------------------------------------------------ */

    var OWN_WIN_CLS = ['grad-win', 'bl-us-window',
                       'vy-win', 'bl-pack-win', 'bl-site-win'];

    function isOwnWindow(win) {
        if (!win) return false;
        if (win.getAttribute && win.getAttribute('data-bl-own')) return true;
        if (!win.classList) return false;
        for (var i = 0; i < OWN_WIN_CLS.length; i++) {
            if (win.classList.contains(OWN_WIN_CLS[i])) return true;
        }
        return false;
    }

    function nativeWinLabel(win) {
        if (!win) return '窗口';
        var t = win.querySelector('.addon-window-title');
        var s = t ? (t.textContent || '').trim() : '';
        return s || '窗口';
    }

    function dockNativeWindow(win) {
        if (!win) return false;
        if (!win.__blDockId) {
            win.__blDockId = 'nw_' + Date.now().toString(36) +
                Math.floor(Math.random() * 1e4).toString(36);
        }
        /* 复用 dockMinimize：记位置 → 隐藏 → 加托盘图标 → 点图标原样还原 */
        return dockMinimize(win, {
            id: win.__blDockId,
            label: nativeWinLabel(win),
            svg: DOCK_MIN_SVG
        });
    }

    /* 窗口真被关掉时（关闭按钮 / 程序移除）把托盘图标一起清掉，
       否则 DOCK 上会留下一个点了没反应的残影。 */
    function watchDockedRemoval() {
        if (!window.MutationObserver || watchDockedRemoval.done) return;
        watchDockedRemoval.done = true;
        var forget = function (el) {
            if (el && el.__blDockId) dockForget(el.__blDockId);
        };
        var obs = new window.MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var rm = muts[i].removedNodes || [];
                for (var j = 0; j < rm.length; j++) {
                    var n = rm[j];
                    if (!n || n.nodeType !== 1) continue;
                    if (n.classList && n.classList.contains('addon-window')) forget(n);
                    if (n.querySelectorAll) {
                        var ws = n.querySelectorAll('.addon-window');
                        for (var k = 0; k < ws.length; k++) forget(ws[k]);
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function initNativeDockMin() {
        if (initNativeDockMin.done) return;
        initNativeDockMin.done = true;
        document.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest
                ? e.target.closest('.addon-window-btn-minimize') : null;
            if (!btn) return;
            var win = btn.closest('.addon-window');
            if (!win) return;
            if (isOwnWindow(win) || isTopLayerEl(win)) return;
            /* 已经收在 DOCK 里：再点一次最小化应当把它放回来 */
            if (win.__blDockId && dockTrayHas(win.__blDockId)) {
                var t = dockTray();
                if (t && t.restore) t.restore(win.__blDockId);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (!dockNativeWindow(win)) return;   /* DOCK 不可用 → 保持原生行为 */
            e.preventDefault();
            e.stopPropagation();
        }, true);
        watchDockedRemoval();
    }

    /* ================================================================== *
     * 文字可读性守卫
     *
     * "部分场景下字看不清"是两类原因叠加：
     *   1) 我们自己加的 UI 里有多处【固定白字 + 主题强调色底】。
     *      强调色随主题变（青绿 #75C1C4 / 樱花粉 / 自定义渐变…），
     *      浅色强调色上写白字，对比度只有 2.06 —— 根本读不出来。
     *   2) 毛玻璃 / 液态玻璃开启后背景是半透明的，静态配色算不准实际底色。
     *
     * 两层处理：
     *   · --bl-on-accent：由当前强调色算出黑或白，供那批固定配色直接引用
     *   · 运行时扫描：玻璃态下静态值不可靠，逐元素实测对比度并纠偏
     * ------------------------------------------------------------------ */

    var ON_ACCENT_LIGHT = '#ffffff';
    var ON_ACCENT_DARK = '#14181f';

    function parseCssColor(str) {
        if (!str) return null;
        var s = String(str).trim();
        if (s === 'transparent') return null;
        /* 十六进制：#rgb / #rgba / #rrggbb / #rrggbbaa
           ⚠ 必须支持。--looks-secondary 这类强调色就是 hex 写的，
           只认 rgb() 的话解析一律返回 null，--bl-on-accent 永远设不上，
           那些"白字 + 强调色底"的样式就永久停在 2.06 的对比度上。 */
        if (s.charAt(0) === '#') {
            var h = s.slice(1);
            var hex = '';
            if (h.length === 3 || h.length === 4) {
                for (var q = 0; q < h.length; q++) hex += h.charAt(q) + h.charAt(q);
            } else if (h.length === 6 || h.length === 8) {
                hex = h;
            } else {
                return null;
            }
            if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
            var hc = {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
                a: hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
            };
            return (isNaN(hc.r) || isNaN(hc.g) || isNaN(hc.b)) ? null : hc;
        }
        var m = s.match(/^rgba?\(([^)]+)\)$/i);
        if (!m) return null;
        var p = m[1].split(/[,\s/]+/);
        if (p.length < 3) return null;
        var c = { r: parseFloat(p[0]), g: parseFloat(p[1]), b: parseFloat(p[2]),
                  a: p.length > 3 && p[3] !== '' ? parseFloat(p[3]) : 1 };
        if (isNaN(c.a)) c.a = 1;
        return (isNaN(c.r) || isNaN(c.g) || isNaN(c.b)) ? null : c;
    }

    function overColor(fg, bg) {
        var a = fg.a;
        return { r: fg.r * a + bg.r * (1 - a),
                 g: fg.g * a + bg.g * (1 - a),
                 b: fg.b * a + bg.b * (1 - a), a: 1 };
    }

    function relLum(c) {
        function f(v) {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }

    function contrastOf(a, b) {
        var l1 = relLum(a), l2 = relLum(b);
        var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
        return (hi + 0.05) / (lo + 0.05);
    }

    /* 逐层向上合成，拿到真正看到的底色（半透明玻璃叠过之后的颜色） */
    function effectiveBg(el) {
        var stack = [], n = el, guard = 0;
        while (n && n.nodeType === 1 && guard++ < 24) {
            var c = parseCssColor(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0) {
                stack.push(c);
                if (c.a >= 0.995) break;
            }
            n = n.parentElement;
        }
        var base = { r: 255, g: 255, b: 255, a: 1 };
        for (var i = stack.length - 1; i >= 0; i--) base = overColor(stack[i], base);
        return base;
    }

    function pickOnColor(bg) {
        return contrastOf({ r: 255, g: 255, b: 255, a: 1 }, bg) >=
               contrastOf({ r: 20, g: 24, b: 31, a: 1 }, bg)
            ? ON_ACCENT_LIGHT : ON_ACCENT_DARK;
    }

    /* --looks-secondary 是界面的强调色（随主题变）。
       由它算出可读的前景色，供 CSS 里那些"白字 + 强调色底"的样式引用。 */
    function updateOnAccent() {
        try {
            var raw = getComputedStyle(document.documentElement)
                .getPropertyValue('--looks-secondary');
            var c = parseCssColor((raw || '').trim());
            if (!c) return;
            var bg = { r: c.r, g: c.g, b: c.b, a: 1 };
            document.documentElement.style.setProperty('--bl-on-accent', pickOnColor(bg));
        } catch (e) { /* ignore */ }
    }

    /* 只扫我们自己加的 UI：编辑器原生界面有自己的配色体系，不该被我们改 */
    var READABLE_ROOTS = ['.bl-top-layer', '.bl-dock',
                          '.vy-win', '.grad-win', '.bl-us-window'];

    function readableRoots() {
        var out = [], i;
        for (i = 0; i < READABLE_ROOTS.length; i++) {
            var ns = document.querySelectorAll(READABLE_ROOTS[i]);
            for (var k = 0; k < ns.length; k++) out.push(ns[k]);
        }
        return out;
    }

    var READABLE_MIN = 3.2;   /* 低于这个值肉眼就开始吃力 */

    function fixReadableOnce() {
        var roots = readableRoots(), i;
        for (i = 0; i < roots.length; i++) fixReadableIn(roots[i]);
    }

    function fixReadableIn(root) {
        if (!root || !root.querySelectorAll) return;
        var els = root.querySelectorAll('*');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.children && el.children.length) continue;    /* 只看直接含文字的叶子 */
            var txt = (el.textContent || '').trim();
            if (!txt) continue;
            var cs = null;
            try { cs = getComputedStyle(el); } catch (e) { continue; }
            if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
            if (parseFloat(cs.opacity) < 0.35) continue;
            var r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            /* 图标字体（stroke 型 SVG 的父层）与纯装饰不算文字 */
            if (cs.webkitTextFillColor === 'transparent') continue;

            /* 自带配色的浮层不参与自动改色。DOCK 悬浮名称是「深色底 + 白字」，
               一旦底色被液态玻璃改浅，守卫会把白字改成近黑，名字就全黑看不见。
               顺便清掉上一次可能已经写进去的 inline color / textShadow。 */
            if (el.getAttribute && el.getAttribute('data-bl-fc-skip')) {
                if (el.__blFcFixed) {
                    el.style.color = '';
                    el.style.textShadow = '';
                    el.__blFcFixed = 0;
                }
                continue;
            }

            /* ⚠ 判定"需不需要修"必须看样式表本来的颜色，不能看当前颜色。
               之前直接读 cs.color：第一次扫到白字 → 改成深色；第二次扫读到的
               是"我们刚改的深色" → 判成已达标 → 把内联色清掉 → 变回白字；
               第三轮再来一次。于是每 2 秒在黑白之间来回抖一次，
               表现就是"字一会儿看得清一会儿看不清"。
               所以先把上次加的内联色摘掉，量到基准色再决定。 */
            var wasFixed = !!el.__blFcFixed;
            if (wasFixed) {
                el.style.color = '';
                el.style.textShadow = '';
                el.__blFcFixed = 0;
                try { cs = getComputedStyle(el); } catch (e) { continue; }
            }

            var fg = parseCssColor(cs.color);
            if (!fg) continue;
            var bg = effectiveBg(el);
            var fgO = fg.a < 1 ? overColor(fg, bg) : fg;
            var cr = contrastOf(fgO, bg);
            var sig = Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) +
                '|' + cs.color;
            /* ⚠ 刚摘掉内联色的元素必须跳过缓存：摘掉后 sig 一定跟上次记录的
               一模一样（记录的本来就是基准色），命中缓存就直接 continue，
               修正再也没机会施加 —— 表现是"稳定白字、守卫像没工作"。 */
            if (!wasFixed && el.__blFcSig === sig) continue;
            el.__blFcSig = sig;

            if (cr >= READABLE_MIN) continue;
            var best = pickOnColor(bg);
            var bestC = best === ON_ACCENT_LIGHT
                ? { r: 255, g: 255, b: 255, a: 1 } : { r: 20, g: 24, b: 31, a: 1 };
            el.style.color = best;
            /* 中间调底色上黑白都到不了 4.5，加一层描边把字形从背景里拔出来 */
            el.style.textShadow = contrastOf(bestC, bg) < 4.5
                ? (best === ON_ACCENT_LIGHT
                    ? '0 1px 2px rgba(0,0,0,0.45)' : '0 1px 2px rgba(255,255,255,0.55)')
                : '';
            el.__blFcFixed = 1;
        }
    }

    var readableTimer = 0;
    function scheduleReadable() {
        if (readableTimer) return;
        readableTimer = window.setTimeout(function () {
            readableTimer = 0;
            try { updateOnAccent(); fixReadableOnce(); } catch (e) { /* ignore */ }
        }, 260);
    }

    function initReadability() {
        if (initReadability.done) return;
        initReadability.done = true;
        updateOnAccent();
        /* 主题切换会把强调色整批换掉，事件比轮询准 */
        window.addEventListener('mw:theme-applied', scheduleReadable);
        window.addEventListener('resize', scheduleReadable);
        /* 不用 MutationObserver 盯着整棵文档：Blockly 每拖一个积木都会成片改 DOM，
           260ms 的防抖会被打成"一直在扫"，反而拖慢编辑器。
           玻璃态下底色是运行时算出来的，只有轮询能覆盖到，所以低频走一圈。 */
        window.setInterval(function () {
            if (document.visibilityState && document.visibilityState !== 'visible') return;
            if (dragState) return;               /* 拖动中不做强制布局 */
            scheduleReadable();
        }, 2000);
        scheduleReadable();
    }

    /* ================================================================== *
     * 设置 → 常规 → 版本号
     *
     * 版本号是随每次构建一起写死的（build.py 注入），不在界面上提供编辑：
     * 它描述的是"这个 HTML 是哪一版"，改了也不代表文件变了。
     * 每次发新版前把 build.py 顶部的 BL_VERSION 改掉即可。
     * ------------------------------------------------------------------ */

    var BL_VERSION = '1.0.5 SEA';

    /* ================================================================== *
     * 版本历史页（右侧内容区）
     * ------------------------------------------------------------------ *
     * 点击侧栏「版本号」后，右侧不再停留在别的分类，而是显示：
     *   当前版本 hero + 历代版本时间线（版本号 / 更新时间 / 更新内容）
     * 数据写在 BL_VERSION_HISTORY，按实际发版记录改这个数组即可。
     * ================================================================== */
    var BL_VERSION_HISTORY = [{"v":"1.0.5 SEA","vEn":"1.0.5 SEA","date":"2026-11-10","dateEn":"2026-11-10","current":true,"title":"当前版本 · STAR AI 聊天 / 教学","titleEn":"Current · STAR AI chat / teach","items":["版本号统一为 1.0.5 SEA","「保存到此电脑」三选一弹窗：SB3 / STAR / RJ 任选，所选格式直接下载","设置 → 常规 新增「STAR AI」分区：总开关、称呼、温度、API（内置三个免费模型）、只读能力说明","STAR AI 快捷启动键 STT（依次按 S、T、T）","STAR AI 收窄为聊天与教学：不代编程、不生成积木、不点击编辑器，只用文字讲 Start Editor 的用法","音乐编辑器回退到学习前版本并接入在线音乐素材库（离线显示「请联网」）","工具箱「作品格式转换」升级：STAR.sb3 / .STAR / .rj 三格式任意互转","重做项目面板：一行 3 个作品卡片、搜索排序、导入导出、空态与悬停操作","保存/切换/导入并行序列化、乐观写库、内存预取，常规作品 3 秒内完成并带分阶段加载动画","新增「保存为 .rj」；菜单文案兼容「保存到此电脑」等别名，弹窗支持数字键 1 / 2 / 3 与 Esc","放下一个积木即后台预编译 SB3 / STAR / RJ 三种字节，点保存直接取缓存，通常零等待","版本历史卡重做：7 个版本各有独立配色、背景、动画、宣传语与排版"],"itemsEn":["Version unified as 1.0.5 SEA","Save-to-computer now opens a three-choice dialog: pick SB3, STAR or RJ and download that format","Settings → General → STAR AI: enable switch, your name, temperature, API (three built-in free models), read-only capability","STAR AI shortcut STT (press S, T, T in order)","STAR AI is now chat-and-teach only: no programming, no block generation, no editor clicking — it explains Start Editor in plain text","Music editor rolled back to the pre-study build with an online sample library (offline shows \"Please connect to the internet\")","Toolbox Project Format Converter upgraded: any-to-any STAR.sb3 / .STAR / .rj conversion","Project panel redesigned: three cards per row, search, sorting, import/export, empty states and hover actions","Save / switch / import now serialize in parallel, write optimistically and prefetch into memory — typical projects finish within 3s with a staged loading animation","Added Save as .rj; the menu matcher accepts \"Save to this computer\" aliases and the dialog supports keys 1 / 2 / 3 and Esc","Dropping a block precompiles SB3 / STAR / RJ bytes in the background, so saving usually downloads from cache with zero wait","Release cards redesigned: seven builds each get their own palette, background, animation, slogan and layout"],"theme":{"key":"sea","layout":"feature","code":"SEA · 01 / CURRENT","codeEn":"SEA · 01 / CURRENT","vPrefix":"v","vSuffix":"","dateFmt":"iso","slogan":"把想法交给对话，把速度留给你","sloganEn":"Talk to ideas. Ship at speed.","note":"对话负责理解，预编译负责等待","noteEn":"Conversation understands; precompilation waits."}},{"v":"1.0.4 ART","vEn":"1.0.4 ART","date":"2026-11-07","dateEn":"2026-11-07","current":false,"title":"当前版本 · 工具箱与扩展生态","titleEn":"Current · Toolbox & extension ecosystem","items":["版本号统一为 1.0.4 ART","DOCK「工具箱」：作品比较 / 帧率 / 性能模式 / 录制舞台 / 屏幕滤镜 / 性能，六个工具各自打开独立弹窗","扩展库来源严格固定为 10 项（含 RemixWarp、PenguinMod、02Engine、OpenWarp、CY ScrExt Hub），移除 SharkPool 与自定义源追加","接入 02Engine 与 CY ScrExt Hub 官方扩展清单；其余源支持通过 __blExtSources.set() 配置端点","合并 105 段内嵌脚本、惰性数据压缩与作品缓存优化，打开编辑器与加载作品进一步提速"],"itemsEn":["Version unified as 1.0.4 ART","Dock Toolbox: Project Compare / Frame Rate / Perf Mode / Stage Recorder / Screen Filter / Performance — six standalone popup windows","Extension gallery sources fixed to exactly 10 (including RemixWarp, PenguinMod, 02Engine, OpenWarp, CY ScrExt Hub); removed SharkPool and custom-source appending","Wired the official 02Engine and CY ScrExt Hub galleries; other sources accept custom endpoints via __blExtSources.set()","Merged 105 embedded scripts, lazy-payload compression and project caching for faster editor startup and project loading"],"theme":{"key":"art","layout":"canvas","code":"ART · FRAME BY FRAME","codeEn":"ART · FRAME BY FRAME","vPrefix":"№ ","vSuffix":"","dateFmt":"dot","slogan":"每一帧都值得被设计","sloganEn":"Every frame deserves to be designed","note":"曲面、流光、液态玻璃","noteEn":"Curves, flowing light and liquid glass"}},{"v":"1.0.3 STAR","date":"2026-11-07","dateEn":"2026-11-07","title":"交互与稳定性收束","titleEn":"Interaction & stability","items":["「版本号」页面改为历代版本 / 更新内容 / 更新时间 / 当前版本","弹窗外观控件在玻璃开启时恢复可拖动、可点击，改动即时生效","毛玻璃与液态玻璃设置写入即时生效，不再等待轮询","DOCK 栏隐藏 / 显示：三个入口即时迁移，带滑入与淡出动画","修复「显示 DOCK」后左侧三个入口残留不消失","版本号统一为 1.0.3 STAR"],"itemsEn":["Version page now shows release history, changelog, dates and current version","Popup Appearance controls stay draggable/clickable while glass is on; changes apply instantly","Frosted / Liquid Glass settings apply immediately instead of waiting for polling","Hide / Show Dock moves the three entries instantly with slide-in / fade-out animation","Fixed leftover left-side entries after showing the Dock again","Version unified as 1.0.3 STAR"],"theme":{"key":"star","layout":"spotlight","code":"STAR · STABILITY","codeEn":"STAR · STABILITY","vPrefix":"BUILD ","vSuffix":"","dateFmt":"upper","slogan":"把稳定，做成习惯","sloganEn":"Stability, made a habit","note":"交互与稳定性的收束","noteEn":"Where interaction and stability converged"}},{"v":"1.0.3 STAR · 构建 3","vEn":"1.0.3 STAR · build 3","date":"2026-11-07","dateEn":"2026-11-07","title":"下拉列表与窗口按钮","titleEn":"Dropdowns & window buttons","items":["修复设置页 19 处下拉选项显示 [object Object]（中英文双语）","恢复弹窗顶部栏原版三键：最小化 — ／ 最大化 □ ／ 关闭 ×","自定义图标导入 / 清除链路保持可用"],"itemsEn":["Fixed 19 dropdown options rendering as [object Object] (zh / en)","Restored the original three window buttons: minimize — / maximize □ / close ×","Custom icon import / clear flow kept working"],"theme":{"key":"grid","layout":"split","code":"CONSTRUCT 03 / UI","codeEn":"CONSTRUCT 03 / UI","vPrefix":"#","vSuffix":"","dateFmt":"slash","slogan":"细节对齐，交互才顺手","sloganEn":"Aligned details, smoother interaction","note":"下拉列表与窗口按钮","noteEn":"Dropdowns and window controls"}},{"v":"1.0.3 STAR · 构建 2","vEn":"1.0.3 STAR · build 2","date":"2026-11-07","dateEn":"2026-11-07","title":"工作区遮挡","titleEn":"Workspace overlay","items":["「项目 / 后台」面板不再被积木分类栏与 flyout 挡住","面板层级抬到 30、标签栏抬到 40，切回「代码」原样恢复"],"itemsEn":["Project / Backend panels no longer covered by the block category menu or flyout","Panel z-index 30, tab bar 40; switching back to Code restores everything"],"theme":{"key":"mint","layout":"compact","code":"CONSTRUCT 02 / SPACE","codeEn":"CONSTRUCT 02 / SPACE","vPrefix":"— ","vSuffix":"","dateFmt":"short","slogan":"让每一寸工作区都清爽","sloganEn":"Room for what matters","note":"工作区遮挡修复","noteEn":"Workspace overlap fixes"}},{"v":"1.0.3 STAR · 构建 1","vEn":"1.0.3 STAR · build 1","date":"2026-11-07","dateEn":"2026-11-07","title":"左侧标签栏","titleEn":"Left tab bar","items":["修复「项目 / 后台」点击后左侧选项全部消失、工作区错位","四个自定义标签互斥收起，点原生标签自动收回","保存 / 导入当前项目兼容 Promise"],"itemsEn":["Fixed left tabs disappearing and workspace offset when clicking Project / Backend","Four custom tabs are mutually exclusive; clicking a native tab closes them","Save / import project handles Promise results"],"theme":{"key":"indigo","layout":"rail","code":"CONSTRUCT 01 / NAV","codeEn":"CONSTRUCT 01 / NAV","vPrefix":"No.","vSuffix":"","dateFmt":"day","slogan":"从左侧开始，重新组织","sloganEn":"It starts on the left","note":"左侧标签栏","noteEn":"The left tab rail"}},{"v":"1.0.1bate","date":"初始构建 · 时间未记录","dateEn":"Initial build · date not recorded","title":"首个随文件分发的版本","titleEn":"First bundled build","items":["离线单文件编辑器、自定义设置页、窗口系统、DOCK 栏、玻璃效果","原文件未在版本信息中记录独立发布时间"],"itemsEn":["Offline single-file editor, custom settings, window system, Dock, glass effects","The original file does not record a standalone release timestamp"],"theme":{"key":"mono","layout":"blueprint","code":"// 000 · ORIGIN","codeEn":"// 000 · ORIGIN","vPrefix":"[","vSuffix":"]","dateFmt":"none","slogan":"一切从这里开始","sloganEn":"Where it all began","note":"首个随文件分发的版本","noteEn":"First build shipped with this file"}}];

    var verActive = false;      /* 当前是否处于「版本历史」页 */
    var verItem = null;         /* 侧栏「版本号」按钮 */
    var verModal = null;        /* 设置窗口根节点，用来判断窗口是否被关掉 */
    var verPanel = null;        /* 右侧历史面板 */
    var verPrevSel = null;      /* 进入版本页前被选中的那一项，退出时还原 */

    function verIsZh() {
        try { return /^zh/i.test(document.documentElement.lang || ''); }
        catch (e) { return true; }
    }

    function verBody() {
        var c = document.querySelector('[class*="modal-sidebar_content_"]');
        if (!c) return null;
        return c.querySelector('[class*="settings-modal_body_"]') || c;
    }

    function verEsc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* 每个版本的日期文本格式随主题变化（真实日期不变，只换呈现） */
    function verDate(d, fmt, zh) {
        if (fmt === 'none') return zh ? '时间未记录' : 'no timestamp';
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
        if (!m) return d;
        var y = m[1], mo = m[2], da = m[3];
        var MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        if (fmt === 'dot') return y + '.' + mo + '.' + da;
        if (fmt === 'slash') return mo + ' / ' + da;
        if (fmt === 'upper') return MON[+mo - 1] + ' ' + da + ', ' + y;
        if (fmt === 'short') return mo + '.' + da;
        if (fmt === 'day') return 'DAY ' + da;
        return d;
    }

    function buildVersionHistory() {
        var zh = verIsZh();
        var box = document.createElement('div');
        box.className = 'bl-ver-history';
        var counts = BL_VERSION_HISTORY.length;
        var html =
            '<div class="bl-ver-hero">' +
                '<div class="bl-ver-hero-k">' + (zh ? '当前版本' : 'Current version') + '</div>' +
                '<div class="bl-ver-hero-v">v' + verEsc(BL_VERSION) +
                    '<span class="bl-ver-badge">' + (zh ? '当前' : 'CURRENT') + '</span></div>' +
                '<div class="bl-ver-hero-d">' +
                    (zh ? '发布时间' : 'Released') + ' 2026-11-07 · ' +
                    (zh ? '共 ' : '') + counts + (zh ? ' 条版本记录' : ' release records') +
                '</div>' +
                '<div class="bl-ver-hero-note">' +
                    (zh ? '离线单文件版 · 版本随当前 HTML 一起分发'
                        : 'Offline single-file build · version ships with this HTML') +
                '</div>' +
            '</div>' +
            '<div class="bl-ver-sec"><span>' + (zh ? '历代版本与更新内容' : 'Release history & changelog') + '</span>' +
                '<span class="bl-ver-sec-hint">' +
                    (zh ? '共 ' + counts + ' 条 · 向下滚动查看更早版本 ↓'
                        : counts + ' entries · scroll for older builds ↓') +
                '</span></div>' +
            '<div class="bl-ver-timeline">';

        for (var i = 0; i < BL_VERSION_HISTORY.length; i++) {
            var r = BL_VERSION_HISTORY[i];
            var th = r.theme || {};
            var key = th.key || ('v' + i);
            var lay = th.layout || 'feature';
            var v = zh ? (r.v || '') : (r.vEn || r.v || '');
            var d = zh ? (r.date || '') : (r.dateEn || r.date || '');
            var t = zh ? (r.title || '') : (r.titleEn || r.title || '');
            var items = zh ? (r.items || []) : (r.itemsEn || r.items || []);
            var code = zh ? (th.code || '') : (th.codeEn || th.code || '');
            var slogan = zh ? (th.slogan || '') : (th.sloganEn || th.slogan || '');
            var note = zh ? (th.note || '') : (th.noteEn || th.note || '');
            var vTxt = verEsc((th.vPrefix || '') + v + (th.vSuffix || ''));
            var dTxt = verEsc(verDate(d, th.dateFmt || 'iso', zh));
            html += '<div class="bl-ver-entry' + (r.current ? ' is-current' : '') +
                    ' bl-ver-t-' + key + ' bl-ver-l-' + lay + '"' +
                    ' data-ver-theme="' + key + '" data-ver-layout="' + lay + '">' +
                '<div class="bl-ver-dot"></div>' +
                '<div class="bl-ver-card2">' +
                    '<div class="bl-ver-deco" aria-hidden="true"></div>' +
                    '<div class="bl-ver-eyebrow">' + verEsc(code) + '</div>' +
                    '<div class="bl-ver-row1">' +
                        '<span class="bl-ver-v">' + vTxt + '</span>' +
                        (r.current ? '<span class="bl-ver-tag">' + (zh ? '当前版本' : 'Current') + '</span>' : '') +
                        '<span class="bl-ver-date">' +
                            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>' +
                            dTxt + '</span>' +
                    '</div>' +
                    '<div class="bl-ver-title">' + verEsc(t) + '</div>' +
                    '<div class="bl-ver-slogan">' + verEsc(slogan) + '</div>' +
                    '<div class="bl-ver-note">' + verEsc(note) + '</div>' +
                    '<ul class="bl-ver-items">';
            for (var j = 0; j < items.length; j++) {
                html += '<li>' + verEsc(items[j]) + '</li>';
            }
            html += '</ul></div></div>';
        }

        html += '</div>' +
            '<div class="bl-ver-foot">' +
                (zh
                    ? '说明：本表依据当前文件内可考证的变更与本次修复记录整理；早期构建未记录独立时间戳，已如实标注。'
                    : 'Note: entries are compiled from changes verifiable in this file and this repair session; early builds have no standalone timestamp and are marked as such.') +
            '</div>';
        box.innerHTML = html;
        return box;
    }


    function verSyncPage() {
        var body = verBody();
        var it = document.querySelector('[data-bl-ver]');
        if (!body || !it) return;                 /* 设置窗口还没渲染 / 已关闭 */
        if (!verPanel || verPanel.parentNode !== body) {
            verPanel = buildVersionHistory();
            body.appendChild(verPanel);
        }
        verItem = it;
        body.classList.toggle('bl-ver-mode', verActive);
        verPanel.classList.toggle('is-on', verActive);
        it.classList.toggle('is-on', verActive);

        /* 选中态类名带 CSS Modules hash。React 仍认为选中的是原来那项，
           所以进入版本页时把其它分类的高亮摘掉、退出时原样还回去，
           否则侧栏会同时出现两个高亮项。 */
        try {
            var nav = document.querySelector('[class*="modal-sidebar_items_"]') || document;
            var any = nav.querySelector('[class*="modal-sidebar_itemSelected_"]');
            var m = (any ? any.className : it.className)
                .match(/modal-sidebar_itemSelected_[A-Za-z0-9_-]+/);
            var cls = m ? m[0] : '';
            if (verActive) {
                var sels = nav.querySelectorAll('[class*="modal-sidebar_itemSelected_"]');
                for (var q = 0; q < sels.length; q++) {
                    if (sels[q] === it) continue;
                    var mm = String(sels[q].className)
                        .match(/modal-sidebar_itemSelected_[A-Za-z0-9_-]+/);
                    if (!mm) continue;
                    if (!verPrevSel) verPrevSel = { el: sels[q], cls: mm[0] };
                    sels[q].classList.remove(mm[0]);
                }
                if (cls) it.classList.add(cls);
            } else {
                if (cls) it.classList.remove(cls);
                if (verPrevSel && verPrevSel.el && verPrevSel.el.isConnected) {
                    verPrevSel.el.classList.add(verPrevSel.cls);
                }
                verPrevSel = null;
            }
        } catch (e) { /* ignore */ }
    }

    function verSetActive(on) {
        verActive = !!on;
        verSyncPage();
    }
    /* [1.0.5 SEA] 供「STAR AI」分区调用：切到 STAR AI 时关掉版本历史页 */
    window.__blVerSetActive = verSetActive;

    /* 全局捕获：点「版本号」进入历史页，点其它侧栏项立刻退出。
       只在首次安装一次，React 重渲染侧栏不会让监听失效。 */
    function verInstallClick() {
        if (window.__blVerClick) return;
        window.__blVerClick = true;
        document.addEventListener('click', function (e) {
            var t = e && e.target;
            if (!t || !t.closest) return;
            if (t.closest('[data-bl-ver]')) { verSetActive(true); return; }
            if (t.closest('[class*="modal-sidebar_item_"]')) verSetActive(false);
        }, true);
    }

    /* 中英文都认：界面语言是可切换的，类名带 hash，只能按文本找 */
    var VER_GROUP = ['常规', 'General'];
    var VER_ANCHOR = ['键盘快捷键', 'Keyboard Shortcuts'];

    function sidebarGroup(names) {
        var gs = document.querySelectorAll('[class*="modal-sidebar_group_"]');
        for (var i = 0; i < gs.length; i++) {
            var hdr = gs[i].querySelector('[class*="modal-sidebar_groupHeader_"]');
            var t = hdr ? (hdr.textContent || '').trim() : '';
            for (var k = 0; k < names.length; k++) {
                if (t === names[k]) return gs[i];
            }
        }
        return null;
    }

    function sidebarItemIn(group, names) {
        if (!group) return null;
        var its = group.querySelectorAll('[class*="modal-sidebar_item_"]');
        for (var i = 0; i < its.length; i++) {
            var lb = its[i].querySelector('[class*="modal-sidebar_label_"]');
            var t = lb ? (lb.textContent || '').trim() : (its[i].textContent || '').trim();
            for (var k = 0; k < names.length; k++) {
                if (t === names[k]) return its[i];
            }
        }
        return null;
    }

    function insertAfter(node, ref) {
        if (!node || !ref || !ref.parentNode) return false;
        if (ref.nextSibling) ref.parentNode.insertBefore(node, ref.nextSibling);
        else ref.parentNode.appendChild(node);
        return true;
    }

    function buildVersionItem(anchor) {
        if (!anchor) return null;
        /* 直接克隆原生条目：类名（含 CSS Modules hash）、结构、尺寸全都一致，
           手写一份必然对不上，切了皮肤还会跑偏。 */
        var it = anchor.cloneNode(true);
        it.removeAttribute('data-bl-ver-sel');
        it.setAttribute('data-bl-ver', '1');
        it.setAttribute('type', 'button');
        it.setAttribute('title', '版本号');
        it.setAttribute('aria-label', '版本号');
        var sel = it.className.match(/modal-sidebar_itemSelected_[A-Za-z0-9_-]+/);
        if (sel) it.className = it.className.replace(sel[0], '').replace(/\s+/g, ' ').trim();

        var lb = it.querySelector('[class*="modal-sidebar_label_"]');
        if (lb) lb.textContent = '版本号';
        else it.textContent = '版本号';

        /* 图标换成"信息"：克隆出来的是键盘图标，不合适 */
        var sv = it.querySelector('svg');
        if (sv) {
            sv.setAttribute('viewBox', '0 0 24 24');
            sv.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.8" ' +
                'stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/>' +
                '<path d="M12 7.6h.01"/></g>';
        }
        return it;
    }

    function buildVersionCard(valCls) {
        var card = document.createElement('div');
        card.className = 'bl-ver-card';
        card.setAttribute('data-bl-ver-card', '1');
        card.innerHTML =
            '<div class="bl-ver-row"><span class="bl-ver-k">当前版本</span>' +
            '<span class="bl-ver-v">' + BL_VERSION + '</span></div>' +
            '<div class="bl-ver-note">此版本随当前编辑器文件一起分发，' +
            '更新时在这里同步显示。</div>';
        return card;
    }

    function mountVersion() {
        /* 设置窗口整个被移除 = 用户关掉了设置。再打开时应回到默认分类，
           不要莫名其妙地停在版本历史页。侧栏局部重排不会触发这个判断。 */
        if (verModal && !verModal.isConnected) {
            verActive = false;
            verModal = null;
            verPanel = null;
            verItem = null;
            verPrevSel = null;
        }
        verInstallClick();

        var existing = document.querySelector('[data-bl-ver]');
        if (existing) {
            verModal = existing.closest('[class*="settings-modal_modal-content"]') ||
                       existing.closest('.modal-window');
            /* React 重排后把面板摘掉了：补挂回来并保留当前模式 */
            verSyncPage();
            return true;
        }

        var anchor = sidebarItemIn(sidebarGroup(VER_GROUP), VER_ANCHOR);
        if (!anchor) return false;
        var it = buildVersionItem(anchor);
        if (!it) return false;
        if (!insertAfter(it, anchor)) return false;

        verModal = it.closest('[class*="settings-modal_modal-content"]') ||
                   it.closest('.modal-window');
        verSyncPage();
        return true;
    }

    var verWatched = false;
    var verTick = 0;
    var verTimer = null;

    /* 设置窗口是点开才渲染的，且侧栏由 React 管理 —— 切分类会重排子树，
       我们插进去的节点可能被整片换掉。所以装一个常驻观察器：
       节点不在了就补回来（400ms 节流，避免自触死循环）。
       观察器只装一次，但首次没找到锚点也要装，否则设置窗口后开就永远装不上。

       ⚠ 被节流掉的那次必须补一个尾部执行。设置窗口渲染是"一次性的成片
       变更"：如果它正好落在节流窗口里被直接 return，之后 DOM 就静止了，
       再没有第二次触发 —— 表现为"选项永远不出现"。
       这和液态玻璃那次排队的坑是同一个：丢掉的调度不会自己回来。 */
    function installVersionItem() {
        var ok = mountVersion();
        if (verWatched) return ok;
        verWatched = true;
        try {
            var mo = new MutationObserver(function () {
                var now = Date.now();
                var gap = now - verTick;
                if (gap < 400) {
                    if (verTimer) return;
                    verTimer = window.setTimeout(function () {
                        verTimer = null;
                        verTick = Date.now();
                        try { mountVersion(); } catch (e) { /* ignore */ }
                    }, 420 - gap);
                    return;
                }
                verTick = now;
                try { mountVersion(); } catch (e) { /* ignore */ }
            });
            mo.observe(document.body || document.documentElement,
                { childList: true, subtree: true });
        } catch (e) { /* ignore */ }
        try { window.__blVerMount = mountVersion; } catch (e) { /* ignore */ }
        return ok;
    }

    function showSnapPanel() {
        ensureSnapUI();
        snapPanel.classList.add('is-open');
        /* [B104] 升级为原版可拖动窗口后，位置由拖动逻辑与 B104 的
           初始 left/top 负责；这里再写 right/top/left 会把窗口拽回角上。 */
        if (snapPanel.classList.contains('addon-window')) return;
        snapPanel.style.right = '16px';
        snapPanel.style.top = '16px';
        snapPanel.style.left = 'auto';
    }

    function hideSnapUI() {
        if (snapPanel) snapPanel.classList.remove('is-open');
        if (snapPreview) snapPreview.classList.remove('is-open');
        if (snapPanel) {
            var zones = snapPanel.querySelectorAll('.bl-snap-zone');
            for (var i = 0; i < zones.length; i++) zones[i].classList.remove('is-active');
        }
    }

    function highlightZone(id) {
        var zones = snapPanel.querySelectorAll('.bl-snap-zone');
        for (var i = 0; i < zones.length; i++) {
            if (zones[i].getAttribute('data-zone') === id) zones[i].classList.add('is-active');
            else zones[i].classList.remove('is-active');
        }
        var r = id ? zoneRect(id) : null;
        if (r && snapPreview) {
            snapPreview.classList.add('is-open');
            snapPreview.style.left = r.x + 'px';
            snapPreview.style.top = r.y + 'px';
            snapPreview.style.width = r.w + 'px';
            snapPreview.style.height = r.h + 'px';
        } else if (snapPreview) {
            snapPreview.classList.remove('is-open');
        }
    }

    function snapTo(el, id) {
        var r = zoneRect(id);
        if (!r) return;
        /* 线性移动 / 缩放 */
        el.style.transition = 'left .22s linear, top .22s linear, width .22s linear, height .22s linear';
        el.style.left = r.x + 'px';
        el.style.top = r.y + 'px';
        el.style.width = r.w + 'px';
        el.style.height = r.h + 'px';
        var token = (el.__blSnapToken = (el.__blSnapToken || 0) + 1);
        window.setTimeout(function () {
            /* 期间又开始了新的拖动就不要再动它，交给拖动逻辑处理 */
            if (el.__blSnapToken !== token) return;
            el.style.transition = '';
        }, 260);
    }

    function zoneAtPoint(x, y) {
        if (!snapPanel) return null;
        var zones = snapPanel.querySelectorAll('.bl-snap-zone');
        for (var i = 0; i < zones.length; i++) {
            var zr = zones[i].getBoundingClientRect();
            if (x >= zr.left && x <= zr.right && y >= zr.top && y <= zr.bottom) {
                return zones[i].getAttribute('data-zone');
            }
        }
        return null;
    }

    /* 拖动完全由这里接管。
       编辑器自己的窗口系统也有一套拖动（AddonWindow.addDragFunctionality），
       它同样监听 header 的 pointerdown 并在 pointermove 里改 style.left/top。
       之前我没有阻断它，于是两套逻辑同时读写 left/top —— 尤其在我做贴靠动画时
       原生又补写一次坐标，窗口就会跳到错误的位置，表现为"偶尔错位"。
       现在在捕获阶段直接 stopPropagation，让原生那套根本收不到事件，
       全程只有一处代码在改坐标。 */
    /* 窗口置顶：取当前所有窗口的最大 z-index + 1 */
    /* 原生窗口管理器的基数：let a = 8e3（8000），第一个窗口取 8001。
       它在计数器到达 8999 时会把所有窗口重排回 8001+，
       所以我们也待在 8001..8990 这个区间内，与原生协作而不是对抗。 */
    var WIN_Z_BASE = 8000;
    var WIN_Z_MAX = 8990;

    function isTopLayerEl(el) {
        return !!(el && el.closest && el.closest('#bl-top-layer'));
    }

    /* 收集参与比较的窗口（顶层宿主里的自绘窗口是另一套小数值体系，排除） */
    function collectWindows() {
        var out = [];
        var all = document.querySelectorAll('.addon-window');
        for (var i = 0; i < all.length; i++) {
            if (isTopLayerEl(all[i])) continue;
            /* 工具箱窗口（data-tb）归 __blUnifyFront 管，不进 8001..8990 重排 */
            if (all[i].hasAttribute && all[i].hasAttribute('data-tb')) continue;
            /* 用极高值的原生弹窗不属于我们的体系，别把它们拉进重排 */
            if (isForeignZ(parseInt(all[i].style.zIndex, 10))) continue;
            out.push(all[i]);
        }
        return out;
    }

    /* 接近上限时把窗口重排回 8001 起，避免卡在某个固定高值上再也压不过别人 */
    function renormalizeWindows() {
        var list = collectWindows();
        var arr = [];
        for (var i = 0; i < list.length; i++) {
            var z = parseInt(list[i].style.zIndex, 10);
            arr.push({ el: list[i], z: isNaN(z) ? 0 : z });
        }
        arr.sort(function (a, b) { return a.z - b.z; });
        for (var k = 0; k < arr.length; k++) {
            arr[k].el.style.zIndex = String(WIN_Z_BASE + 1 + k);
        }
        return arr.length;
    }

    /* 顶层宿主内部的窗口自成一系：宿主本身已在最上层（999998），
       里面的窗口只需互相排序即可。油猴窗口（us.js）就是这么做的，
       渐变编辑器也走同一条路径 —— 否则两套数值体系混在同一个宿主里，
       置顶会互相算错。 */
    function bringTopLayerFront(win) {
        var host = win && win.parentNode;
        if (!host) return;
        var max = 0;
        try {
            var all = host.children;
            for (var i = 0; i < all.length; i++) {
                if (all[i] === win) continue;
                var z = parseInt(all[i].style.zIndex, 10);
                if (!isNaN(z) && z > max) max = z;
            }
        } catch (e) { /* ignore */ }
        var base = Math.max(max, 10);
        if (base > 900) base = 10;
        win.style.zIndex = String(base + 10);
    }

    function bringWindowToFront(win) {
        if (!win) return;
        /* 工具箱窗口不归这套 8001..8990 管，转交统一置顶，避免两套互相覆盖 */
        if (win.hasAttribute && win.hasAttribute('data-tb')) {
            try { if (window.__blUnifyFront) window.__blUnifyFront(win); }
            catch (eTb) { /* ignore */ }
            return;
        }
        if (loadingActive()) return;        /* 加载界面期间保持原生层级 */
        if (isTopLayerEl(win)) { bringTopLayerFront(win); return; }
        /* 这个窗口用的是原生极高值 —— 不归我们管，动了会把压下去 */
        if (isForeignZ(parseInt(win.style.zIndex, 10))) return;

        /* 起点必须包含自身当前值：
           只取"其它窗口最大值 + 1"会在只有一个窗口时算出 1，
           低于积木栏 .blocklyFlyout 的 z-index:20 —— 窗口直接被积木栏盖住。
           包含自身则保证置顶后永远不低于原来的层级。 */
        var cur = parseInt(win.style.zIndex, 10);
        if (isNaN(cur) || cur < WIN_Z_BASE) cur = WIN_Z_BASE;
        var max = cur;

        var all = collectWindows();
        for (var i = 0; i < all.length; i++) {
            if (all[i] === win) continue;
            var z = parseInt(all[i].style.zIndex, 10);
            if (!isNaN(z) && z > max) max = z;
        }
        var next = max + 1;
        if (next > WIN_Z_MAX) {
            var n = renormalizeWindows();
            win.style.zIndex = String(WIN_Z_BASE + 1 + n);
            return;
        }
        if (String(next) !== win.style.zIndex) win.style.zIndex = String(next);
    }

    /* 兜底：任何层级过低的窗口（比如创建时没走置顶）自动抬到原生基准之上。
       积木栏 z-index 为 20，低于 8001 基本都意味着"会被积木栏盖住"。 */
    function watchWindowZ() {
        if (!window.MutationObserver || watchWindowZ.done) return;
        watchWindowZ.done = true;
        var fix = function (el) {
            if (!el || !el.classList || !el.classList.contains('addon-window')) return;
            if (el.hasAttribute && el.hasAttribute('data-tb')) return;  /* 统一置顶接管 */
            if (isTopLayerEl(el)) return;
            var z = parseInt(el.style.zIndex, 10);
            if (!isNaN(z) && (z >= WIN_Z_BASE + 1 || isForeignZ(z))) return;
            bringWindowToFront(el);
        };
        var pending = 0;
        var obs = new window.MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var added = muts[i].addedNodes || [];
                for (var j = 0; j < added.length; j++) fix(added[j]);
            }
            if (pending) return;
            pending = window.setTimeout(function () {
                pending = 0;
                var all = collectWindows();
                for (var k = 0; k < all.length; k++) fix(all[k]);
            }, 400);
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    var HOT_W = 220;
    var HOT_H = 170;

    function initWindows() {
        document.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            var header = e.target && e.target.closest ? e.target.closest('.addon-window-header') : null;
            if (!header) return;
            var win = header.closest('.addon-window');
            if (!win) return;
            /* 标了 bl-win-nodrag 的窗口固定不动（唱片机就是固定在右下角），
               直接放行，让原生逻辑也收不到这次按下 */
            if (win.classList.contains('bl-win-nodrag')) return;
            if (e.target.closest('button')) return;   /* 让最小化/最大化/关闭按钮正常工作 */

            /* 最大化时禁止拖动 */
            if (isMaximized(win)) {
                win.classList.add('bl-window-maximized');
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            win.classList.remove('bl-window-maximized');

            /* 接管：阻断原生拖动 */
            e.stopPropagation();
            e.preventDefault();

            /* 原生 bringToFront 也被一起阻断了，这里自己置顶。
               加载界面期间会直接 return —— 原生弹窗（如扩展权限询问）
               保持自己的层级，不会被重排到加载界面下面去。 */
            bringWindowToFront(win);
            /* 拖动期间必须彻底关掉位置过渡，否则拖动会变成"带过渡跟随"，
               手感滞后、松手位置与指针不一致。
               注意：只清 inline style 是不够的 —— 窗口可能从 CSS 类里
               继承了 transition（例如渐变编辑器 .grad-win 的 0.22s），
               所以必须再加一个专门的"拖动中"类，用 !important 压住。 */
            win.style.transition = '';
            win.classList.add('bl-win-dragging');

            var r = win.getBoundingClientRect();
            dragState = {
                win: win,
                ox: e.clientX - r.left,
                oy: e.clientY - r.top,
                active: false,
                moved: false
            };

            /* 指针捕获：即使移到 iframe（打包器）上也能继续收到 move/up */
            try {
                if (header.setPointerCapture && e.pointerId != null) {
                    header.setPointerCapture(e.pointerId);
                }
            } catch (err) { /* ignore */ }

            window.addEventListener('pointermove', onDragMove, true);
            window.addEventListener('pointerup', onDragUp, true);
            window.addEventListener('pointercancel', onDragUp, true);
        }, true);

        document.addEventListener('pointerdown', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('.addon-window') : null;
            if (!el) return;
            if (isMaximized(el)) el.classList.add('bl-window-maximized');
            else el.classList.remove('bl-window-maximized');
        }, false);
    }

    function onDragMove(e) {
        if (!dragState) return;
        var win = dragState.win;
        var W = window.innerWidth, H = window.innerHeight;

        /* 1) 跟随指针（即时，不加过渡，避免拖影） */
        var x = e.clientX - dragState.ox;
        var y = e.clientY - dragState.oy;
        var w = win.offsetWidth, h = win.offsetHeight;
        /* 夹住：至少保留 100px 可见宽度与整个标题栏，防止拖到屏幕外找不回来 */
        x = Math.max(100 - w, Math.min(x, W - 100));
        y = Math.max(0, Math.min(y, H - 44));
        win.style.left = x + 'px';
        win.style.top = y + 'px';
        dragState.moved = true;

        /* 2) 贴靠：只有面板已经显示时才允许，避免"路过右上角就被贴走" */
        var pick = snapPickRect();
        if (!dragState.active) {
            if (e.clientX >= W - HOT_W && e.clientY <= HOT_H) {
                dragState.active = true;
                showSnapPanel();
            }
        }
        if (!dragState.active) return;
        if (pick && e.clientX >= pick.left && e.clientX <= pick.right &&
            e.clientY >= pick.top && e.clientY <= pick.bottom) {
            highlightZone(zoneAtPoint(e.clientX, e.clientY));
        } else if (pick) {
            /* 指针移出面板区域：取消贴靠，回到普通拖动 */
            dragState.active = false;
            hideSnapUI();
        } else {
            highlightZone(zoneAtPoint(e.clientX, e.clientY));
        }
    }

    /* 面板外扩一圈作为"可拾取区"，看到面板就等于可以选 */
    function snapPickRect() {
        if (!snapPanel || !snapPanel.classList.contains('is-open')) return null;
        var r = snapPanel.getBoundingClientRect();
        var pad = 24;
        return { left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad };
    }

    function onDragUp(e) {
        window.removeEventListener('pointermove', onDragMove, true);
        window.removeEventListener('pointerup', onDragUp, true);
        window.removeEventListener('pointercancel', onDragUp, true);
        if (!dragState) return;
        var state = dragState;
        dragState = null;
        /* 拖动结束：移除"拖动中"标记，位置过渡重新生效（贴靠动画需要它） */
        if (state.win) state.win.classList.remove('bl-win-dragging');
        if (!state.active) return;
        var zone = null;
        var pick = snapPickRect();
        if (pick && e && e.clientX >= pick.left && e.clientX <= pick.right &&
            e.clientY >= pick.top && e.clientY <= pick.bottom) {
            zone = zoneAtPoint(e.clientX, e.clientY);
        }
        hideSnapUI();
        /* 没选中格子就不贴靠，窗口停在拖到的位置 —— 不会莫名跳位 */
        if (zone) snapTo(state.win, zone);
    }

    /* ================================================================== *
     * 打包器：把离线版内嵌进打包器窗口
     * ================================================================== */

    var packagerSource = null;

    /* 内嵌源码的转义方式：用唯一哨兵串，而不是"加反斜杠"的写法。
       被内嵌的 HTML 源码里本来就存在带反斜杠的脚本结束标记（写在 JS 字符串里，
       用来避免提前闭合 HTML 标签）。如果还原时无差别处理，会把这些合法转义
       一起还原成真正的结束标记，凭空制造出一个闭合标签，
       导致外层 script 提前结束、后面几十万字节的 JS 被当成 HTML 文本显示出来
       —— 表现就是打包器 / 插件窗口里显示一堆源码而不是界面。
       哨兵串在源码里天然不存在，只还原哨兵，源码原有的转义原样保留。 */
    var SC = '</' + 'script';
    var CM = '<!' + '--';
    var SC_SENT = '__BL_EMBED_SCRIPT_END__';
    var CM_SENT = '__BL_EMBED_COMMENT_START__';

    function embedSource(id) {
        var el = document.getElementById(id);
        if (!el) return '';
        /* 压缩存储：先同步解压成原文本，再走哨兵还原；未压缩段兼容。 */
        var raw = window.__blDecText ? window.__blDecText(el) : (el.textContent || '');
        if (!raw) return '';
        return raw.split(SC_SENT).join(SC).split(CM_SENT).join(CM);
    }

    function makeBlobUrl(text) {
        if (!text || !window.Blob || !window.URL || !window.URL.createObjectURL) return null;
        try {
            return window.URL.createObjectURL(new window.Blob([text], { type: 'text/html;charset=utf-8' }));
        } catch (e) {
            return null;
        }
    }

    function buildPackagerSource() {
        if (packagerSource) return packagerSource;
        var src = embedSource('bilup-packager-source');
        if (!src) return null;
        /* 主题通过注入变量传递（离线场景下 localStorage 可能不可写）。 */
        var needTheme = '<scr' + 'ipt>window.__blP4Theme=' +
            JSON.stringify(syncPackagerThemeValue()) + '</' + 'scr' + 'ipt>';
        var pos = src.indexOf('<div id="app">');
        if (pos > 0) src = src.slice(0, pos) + needTheme + src.slice(pos);
        else src = needTheme + src;
        packagerSource = src;
        return packagerSource;
    }

    /* 缓存 blob URL。20MB 的文本处理（还原 + 拼接 + 建 Blob）放在点击时做
       会明显拖慢打开速度，所以启动后空闲时先预热一次。 */
    /* 预热：把 20MB 文本还原 + 主题注入提前做完，点击时只剩赋值。
       注意内嵌源码在文档里排在大脚本之后，启动阶段 getElementById 取不到，
       所以预热必须等 DOM 完整后再跑；取不到就重排，不能标记成已完成。 */
    var packagerWarmed = false;

    function warmPackager() {
        if (packagerWarmed) return true;
        var el = document.getElementById('bilup-packager-source');
        if (!el || !(el.textContent || '').length) return false;
        try {
            if (!buildPackagerSource()) return false;
        } catch (e) {
            return false;
        }
        packagerWarmed = true;
        return true;
    }

    function scheduleWarmPackager() {
        var attempts = 0;
        var tick = function () {
            if (warmPackager()) return;
            attempts++;
            if (attempts > 20) return;
            window.setTimeout(tick, 1500);
        };
        var start = function () { window.setTimeout(tick, 0); };
        if (document.readyState === 'complete') {
            start();
        } else {
            window.addEventListener('load', function () {
                if (window.requestIdleCallback) {
                    try { window.requestIdleCallback(start, { timeout: 15000 }); return; } catch (e) { /* ignore */ }
                }
                start();
            });
        }
    }

    /* 加载遮罩：20MB 的解析执行必然要花时间，遮住这段时间就不再"白屏一会" */
    function showPackagerLoading(iframe) {
        var host = iframe && iframe.parentNode;
        if (!host) return null;
        var box = document.createElement('div');
        box.className = 'bl-pkg-loading';
        box.innerHTML = '<div class="bl-pkg-spinner"></div><div>正在加载打包器……</div>';
        try {
            if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';
            host.appendChild(box);
        } catch (e) { /* ignore */ }
        return {
            hide: function () {
                try { if (box.parentNode) box.parentNode.removeChild(box); } catch (e) { /* ignore */ }
            }
        };
    }

    var packagerLoading = null;

    function syncPackagerThemeValue() {
        return (THEMES[currentTheme] && THEMES[currentTheme].dark) ? 'dark' : 'light';
    }

    function syncPackagerTheme() {
        var v = syncPackagerThemeValue();
        try {
            window.localStorage.setItem('P4.theme', v);
        } catch (e) { /* ignore */ }
        window.__bilupThemeIsDark = (v === 'dark');
    }

    window.__bilupPackagerURL = function () {
        return null;   /* 打包器一律走 src 直接写入，见 __bilupPackagerSrc */
    };

    /* 打开方式：srcdoc 优先。
       srcdoc 文档继承父窗口的 origin 与 base URL，打包器内部再为 webpack
       chunk 创建 blob URL 才能正常加载；改回 blob: URL 后文档的基础 URL
       变成 blob 本身，相对路径解析不了，chunk 加载中断 —— 这就是上一版
       弹窗又变空白的原因。blob 只在 srcdoc 不可用时兜底。 */
    var lastPackagerIframe = null;

    window.__bilupPackagerSrc = function (iframe) {
        var src = buildPackagerSource();
        if (!src) return null;
        if (!iframe) return src;
        lastPackagerIframe = iframe;
        schedulePackagerHandshake(iframe);
        packagerLoading = showPackagerLoading(iframe);
        var ok = false;
        try {
            iframe.srcdoc = src;
            /* 清掉可能残留的 src，避免两者同时存在导致加载混乱 */
            if (iframe.removeAttribute) iframe.removeAttribute('src');
            ok = true;
        } catch (e) { /* ignore */ }
        if (!ok) {
            var url = makeBlobUrl(src);
            if (url) {
                try { iframe.src = url; } catch (e2) { /* ignore */ }
            }
        }
        armPackagerLoadWatch(iframe);
        return src;
    };

    /* 遮罩兜底：iframe load 完成就收；万一始终收不到握手，25 秒后强制收掉，
       避免"正在加载打包器……"永远盖在窗口上。 */
    var pkgLoadTimer = 0;

    function armPackagerLoadWatch(iframe) {
        var done = function () { hidePackagerLoading(); };
        try {
            iframe.addEventListener('load', done);
        } catch (e) { /* ignore */ }
        window.clearTimeout(pkgLoadTimer);
        pkgLoadTimer = window.setTimeout(done, 25000);
    }

    /* ================================================================== *
     * 打开打包器就自动导入当前作品
     *
     * 正常链路：打包器就绪 -> 发 ready-for-import -> 编辑器回 start-import
     *            -> 编辑器把 sb3 发过去 -> 打包器显示"正在导入"
     * 但有几处会掉链子：
     *   1) 打包器用 location.origin 作为 postMessage 目标，file:// 下是 "null"，
     *      某些浏览器不接受这个 targetOrigin，消息发不出来；
     *   2) 编辑器侧的 handleMessage 有一串前置判断（canOpenPackager 等），
     *      任一不满足就静默 return，用户看到的就是空白且没有导入。
     * 所以这里自己做一遍握手：
     *   - 收到 ready-for-import 立刻用 '*' 回包（最宽松的目标源，一定能送达）；
     *   - 若若干秒都没收到，主动推一次，不等对方先开口。
     * ================================================================== */

    var handshakeDone = false;
    var handshakeTimers = [];

    function getVMForExport() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return (st && st.scratchGui && st.scratchGui.vm) || null;
        } catch (e) {
            return null;
        }
    }

    function projectTitle() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var t = st && st.scratchGui && st.scratchGui.projectState &&
                st.scratchGui.projectState.projectTitle;
            if (t) return String(t);
        } catch (e) { /* ignore */ }
        return 'project';
    }

    function sendImport(target) {
        var vm = getVMForExport();
        if (!vm || typeof vm.saveProjectSb3 !== 'function') return false;
        if (handshakeDone) return true;
        handshakeDone = true;
        try { target.postMessage({ p4: { type: 'start-import' } }, '*'); } catch (e) { /* ignore */ }
        vm.saveProjectSb3('arraybuffer').then(function (buf) {
            var name = projectTitle() + '.sb3';
            try {
                target.postMessage({ p4: { type: 'finish-import', data: buf, name: name } }, '*', [buf]);
            } catch (e) {
                /* 带 transfer 失败时退回不带 transfer 的写法 */
                try { target.postMessage({ p4: { type: 'finish-import', data: buf, name: name } }, '*'); } catch (e2) { /* ignore */ }
            }
        }).catch(function () {
            try { target.postMessage({ p4: { type: 'cancel-import' } }, '*'); } catch (e) { /* ignore */ }
        });
        return true;
    }

    function clearHandshakeTimers() {
        for (var i = 0; i < handshakeTimers.length; i++) window.clearTimeout(handshakeTimers[i]);
        handshakeTimers = [];
    }

    function hidePackagerLoading() {
        if (packagerLoading) {
            try { packagerLoading.hide(); } catch (e) { /* ignore */ }
            packagerLoading = null;
        }
    }

    function schedulePackagerHandshake(iframe) {
        handshakeDone = false;
        clearHandshakeTimers();
        /* 兜底：迟迟没收到 ready-for-import 就自己开口，避免一直空白 */
        var delays = [2500, 5000, 9000, 14000];
        for (var i = 0; i < delays.length; i++) {
            handshakeTimers.push(window.setTimeout(function () {
                if (handshakeDone) { clearHandshakeTimers(); return; }
                var w = iframe && iframe.contentWindow;
                if (!w) return;
                try { sendImport(w); } catch (e) { /* ignore */ }
            }, delays[i]));
        }
    }

    /* ================================================================== *
     * 宣传页：点击顶部 LOGO 进入（内嵌官网单文件版）
     *
     * 菜单条里的 LOGO 是 <a href="/" data-mw-item="__home">，
     * 默认行为是跳转到站点根路径 —— 离线单文件下 "/" 不可达，点了会跳走或白屏。
     * 这里在捕获阶段拦下点击，改为当前页面内全屏打开宣传页，
     * 并提供「返回编辑器」按钮，不销毁编辑器的运行状态。
     * ================================================================== */

    var SITE_SOURCE_ID = 'bilup-site-source';
    var siteSource = null;
    var siteOverlay = null;

    function getSiteSource() {
        if (siteSource) return siteSource;
        siteSource = embedSource(SITE_SOURCE_ID);
        return siteSource;
    }

    var siteSentinel = false;

    /* 关闭时要连 iframe 一起清干净：
       只 remove 父节点的话，某些浏览器仍会保留 iframe 的浏览上下文，
       于是"返回编辑器"之后界面像是被一层透明的东西盖住 / 内容丢失。
       先清空 srcdoc 再摘节点，浏览上下文会真正释放。 */
    function closeSite() {
        if (!siteOverlay) return;
        var ov = siteOverlay;
        siteOverlay = null;
        try {
            var f = ov.querySelector('.bl-site-frame');
            if (f) {
                f.onload = null;
                try { f.srcdoc = ''; } catch (e) { /* ignore */ }
                try { f.src = 'about:blank'; } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) { /* ignore */ }

        /* ⚠ 这里不要调 history.back()。
           实测 back() 之后再点 LOGO 就打不开宣传页了 —— back 会把
           React 的路由状态一起带偏，LOGO 的点击不再落到同一个节点上。
           哨兵条目改成"复用"：下次打开时若哨兵还在就不重复 push，
           history 不会无限增长，用户主动后退时 popstate 也会把它消费掉。 */
        guardEditorShell();
    }

    /* 界面守卫：宣传页 / 作品页返回之后，如果编辑器主界面看起来没了，
       把可疑的全屏残留层清掉并触发一次重排，让 Blockly 重新按当前尺寸布局。 */
    function guardEditorShell() {
        try {
            document.querySelectorAll('.bl-site-overlay').forEach(function (n) {
                if (n.parentNode) n.parentNode.removeChild(n);
            });
        } catch (e) { /* ignore */ }
        try {
            var app = document.getElementById('app');
            if (app) {
                var cs = window.getComputedStyle(app);
                if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
                    app.style.display = '';
                    app.style.visibility = '';
                    app.style.opacity = '';
                }
            }
        } catch (e) { /* ignore */ }
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ }
    }

    function openSite() {
        var src = getSiteSource();
        /* 取不到内嵌源码时不拦截，让 LOGO 保持原有 href 行为 */
        if (!src) return false;
        if (siteOverlay && siteOverlay.parentNode) return true;

        var host = blTopLayer();
        var ov = document.createElement('div');
        ov.className = 'bl-site-overlay';
        ov.innerHTML =
            '<iframe class="bl-site-frame" title="\u5ba3\u4f20\u9875"' +
            /* 不给 allow-top-navigation：宣传页里的外链不会把编辑器顶掉 */
            ' sandbox="allow-scripts allow-same-origin allow-forms allow-popups' +
            ' allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>' +
            '<button type="button" class="bl-site-back" title="\u8fd4\u56de\u7f16\u8f91\u5668"' +
            ' aria-label="\u8fd4\u56de\u7f16\u8f91\u5668">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"' +
            ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<line x1="19" y1="12" x2="5" y2="12"/>' +
            '<polyline points="12 19 5 12 12 5"/></svg>' +
            '<span>\u8fd4\u56de\u7f16\u8f91\u5668</span></button>';
        host.appendChild(ov);

        var frame = ov.querySelector('.bl-site-frame');
        /* srcdoc 继承父文档 origin：页面内脚本与存储都能正常工作。
           2.7MB 的静态页，直接赋值即可，不需要预热。 */
        frame.srcdoc = src;
        siteOverlay = ov;

        ov.querySelector('.bl-site-back').addEventListener('click', closeSite);

        /* iframe 里禁止任何跳转：
           一是宣传页本来就该是纯展示；
           二是 iframe 一旦导航走，会往父页面 history 里塞条目，
           用户按浏览器后退时整个编辑器会被导航掉，看起来像"界面丢失"。 */
        try {
            frame.addEventListener('load', function () {
                try {
                    var d = frame.contentDocument;
                    if (!d) return;
                    d.addEventListener('click', function (ev) {
                        var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
                        if (a) { ev.preventDefault(); ev.stopPropagation(); }
                    }, true);
                } catch (e) { /* 跨域时拿不到 document，忽略 */ }
            });
        } catch (e) { /* ignore */ }

        /* 压一个哨兵 history 状态：
           这样"浏览器后退"只会关闭宣传页，不会真的让页面导航走。 */
        try {
            if (!siteSentinel) {
                window.history.pushState({ blSite: 1 }, '');
                siteSentinel = true;
            }
        } catch (e) { /* ignore */ }

        return true;
    }

    function onSitePopState() {
        /* 后退落到哨兵状态 —— 关掉宣传页即可，编辑器本来就还在 */
        if (siteOverlay) {
            siteSentinel = false;
            /* 用户主动后退 —— 关掉宣传页即可，编辑器本来就还在 */
            var ov = siteOverlay;
            siteOverlay = null;
            try {
                var f = ov.querySelector('.bl-site-frame');
                if (f) { try { f.srcdoc = ''; } catch (e) { /* ignore */ } }
            } catch (e) { /* ignore */ }
            try { if (ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) { /* ignore */ }
            guardEditorShell();
        }
    }

    /* ==========================================================================
     * 首页 / 作品页守卫
     *
     * 编辑器里有一条通往"官网首页"的路径（输入 Scratch 作品链接那一页，
     * 带 Credits / Donate / 隐私政策 页脚）。单文件离线版点进去就是死路：
     * 那些链接全都指向不存在的在线地址。
     *
     * 所以只要那一屏出现，就直接把它摘掉、把编辑器露出来。
     * 这里不按"触发路径"拦截（入口太多、React 路由也不好拦），
     * 改为按这一屏的特征来认——不管从哪儿进来的都能兜住。
     * ======================================================================= */

    var homeGuardOn = false;
    var homeGuardRaf = 0;

    /* 编辑器本体是否已经挂载。
       这一条是守卫的安全阀：启动时（约 0.7s~2.0s）会先出现一个
       "加载作品"用的输入框，其 placeholder 正好是
       https://scratch.mit.edu/projects/ —— 与官网首页的特征完全一样。
       而此时编辑器主体还没挂载，往上找容器会一直爬到 interface_center，
       一旦把它 display:none 掉，之后 React 把编辑器挂进去也永远看不见，
       表现就是整屏纯白（时好时坏，取决于守卫有没有扫到那一瞬）。
       所以：编辑器本体不在，就不做任何隐藏。 */
    function hasEditorShell() {
        try {
            return !!document.querySelector(
                'svg.blocklySvg, [class*="gui_editor-wrapper"], [class*="menu-bar_menu-bar"]');
        } catch (e) {
            return false;
        }
    }

    /* 还原通道：任何被守卫藏起来的容器，只要里面后来长出了编辑器本体，
       立刻恢复显示并撤掉标记。万一哪次还是判错了，也能自愈。 */
    function homeRestorePass() {
        var boxes = document.querySelectorAll('[data-bl-home-hidden]');
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            var inside = false;
            try {
                inside = !!box.querySelector(
                    'svg.blocklySvg, [class*="gui_editor-wrapper"], [class*="menu-bar_menu-bar"]');
            } catch (e) { inside = false; }
            if (!inside) continue;
            try { box.style.removeProperty('display'); } catch (e) { /* ignore */ }
            try { box.removeAttribute('data-bl-home-hidden'); } catch (e) { /* ignore */ }
        }
    }

    function homeSignature() {
        /* 特征一：那个"Scratch 作品链接"输入框 */
        var ins = document.querySelectorAll('input');
        for (var i = 0; i < ins.length; i++) {
            var v = ins[i].value;
            if (!v) v = ins[i].placeholder || '';
            if (String(v).indexOf('https://scratch.mit.edu/projects') === 0) return ins[i];
        }
        /* 特征二：官网页脚那几个链接 */
        var a = document.querySelector(
            'a[href*="donate.html"], a[href*="credits.html"], a[href*="privacy.html"]');
        if (a) return a;
        return null;
    }

    /* 从特征元素往上找到"这一屏"的容器：
       一直往上，直到父层里已经出现编辑器本体为止——再往上就会把编辑器一起藏掉。 */
    function homeContainer(node) {
        var el = node;
        var guard = 0;
        /* 容器里已经有编辑器本体 —— 说明这不是独立的一屏，放弃 */
        try {
            if (el.querySelector && el.querySelector(
                    'svg.blocklySvg, [class*="gui_editor-wrapper"], [class*="menu-bar_menu-bar"]')) {
                return null;
            }
        } catch (e) { /* ignore */ }
        while (el && el.parentElement && guard++ < 16) {
            var p = el.parentElement;
            if (!p || p === document.body || p === document.documentElement) break;
            var hasEditor = false;
            try {
                hasEditor = !!p.querySelector(
                    'svg.blocklySvg, [class*="gui_editor-wrapper"], [class*="menu-bar_menu-bar"]');
            } catch (e) { hasEditor = false; }
            if (hasEditor) break;
            el = p;
        }
        return el;
    }

    function restoreEditorUI() {
        var sels = ['[class*="gui_editor-wrapper"]', '[class*="gui_tabs"]', '.blocklySvg', '#app'];
        for (var i = 0; i < sels.length; i++) {
            var list = document.querySelectorAll(sels[i]);
            for (var k = 0; k < list.length; k++) {
                var cs = null;
                try { cs = getComputedStyle(list[k]); } catch (e) { continue; }
                if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
                    list[k].style.setProperty('display', '', '');
                    list[k].style.setProperty('visibility', 'visible', 'important');
                    list[k].style.setProperty('opacity', '1', 'important');
                }
            }
        }
        /* 顶层宿主里的浮层不受影响，但被整屏遮罩挡住时要让开 */
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ }
    }

    function homeToast(text) {
        var old = document.getElementById('bl-home-back');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var d = document.createElement('div');
        d.id = 'bl-home-back';
        d.textContent = text;
        d.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
            'z-index:2147483000;padding:7px 14px;border-radius:9px;font-size:12px;' +
            'background:rgba(20,23,28,0.88);color:#fff;pointer-events:none;' +
            'box-shadow:0 6px 20px rgba(0,0,0,0.28);transition:opacity .3s ease;';
        document.body.appendChild(d);
        window.setTimeout(function () { d.style.opacity = '0'; }, 1400);
        window.setTimeout(function () {
            if (d.parentNode) d.parentNode.removeChild(d);
        }, 1800);
    }

    function homeGuardScan() {
        homeGuardRaf = 0;
        /* 先还原：被误藏的容器一旦长出编辑器就立刻恢复 */
        homeRestorePass();
        /* 安全阀：编辑器本体不在场（多半还在启动）时不做任何隐藏 */
        if (!hasEditorShell()) return;
        var node = homeSignature();
        if (!node) return;
        var box = homeContainer(node);
        if (!box) return;
        /* 已经处理过就不再重复提示 */
        if (box.getAttribute && box.getAttribute('data-bl-home-hidden')) return;
        try { box.setAttribute('data-bl-home-hidden', '1'); } catch (e) { /* ignore */ }
        try { box.style.setProperty('display', 'none', 'important'); } catch (e) { /* ignore */ }
        restoreEditorUI();
        homeToast('已返回编辑器');
    }

    function homeGuardSchedule() {
        if (homeGuardRaf) return;
        homeGuardRaf = window.requestAnimationFrame(homeGuardScan);
    }

    function installHomeGuard() {
        if (homeGuardOn) return;
        homeGuardOn = true;
        try {
            var mo = new MutationObserver(homeGuardSchedule);
            mo.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) { /* ignore */ }
        /* 兜底：路由切换不一定都产生 DOM 变更 */
        window.setInterval(homeGuardSchedule, 1200);
        homeGuardSchedule();
    }

    function hookHomeLogo() {
        try { window.addEventListener('popstate', onSitePopState); } catch (e) { /* ignore */ }
        /* 事件委托到 document：菜单条由 React 渲染且会被替换，
           直接给元素绑事件会在重渲染后失效。 */
        document.addEventListener('click', function (e) {
            if (e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            var t = e.target;
            if (!t || !t.closest) return;
            var a = t.closest('[data-mw-item="__home"]');
            if (!a) return;
            if (!openSite()) return;
            e.preventDefault();
            e.stopPropagation();
        }, true);

        /* Esc 也能退出宣传页 */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && siteOverlay) {
                e.preventDefault();
                e.stopPropagation();
                closeSite();
            }
        }, true);
    }

    function installPackagerHandshake() {
        if (window.__blPackagerHandshake) return;
        window.__blPackagerHandshake = true;
        /* 捕获阶段：比 React 的 message 监听先执行 */
        window.addEventListener('message', function (e) {
            var d = e.data;
            if (!d || !d.p4 || d.p4.type !== 'ready-for-import') return;
            if (!e.source || typeof e.source.postMessage !== 'function') return;
            /* 只处理打包器 iframe，避免误伤其它来源 */
            if (lastPackagerIframe && e.source !== lastPackagerIframe.contentWindow) return;
            if (sendImport(e.source)) {
                clearHandshakeTimers();
                hidePackagerLoading();
                /* 阻止冒泡阶段的重复处理，否则会导入两次 */
                try { e.stopImmediatePropagation(); } catch (err) { /* ignore */ }
            }
        }, true);
    }

    /* ================================================================== *
     * 插件设置页：把 addon-settings.html 内嵌进 Addons 窗口
     * ================================================================== */

    var addonSource = null;

    function getAddonSource() {
        if (addonSource) return addonSource;
        addonSource = embedSource('bilup-addon-settings-source');
        return addonSource;
    }

    /* 父窗口这边保存的插件设置备份，注入给 iframe 兜底（srcdoc 无法同步读取父存储） */
    var ADDON_BACKUP_PREFIX = 'bl:addon:';

    function readAddonBackup() {
        var out = Object.create(null);
        try {
            var ls = window.localStorage;
            for (var i = 0; i < ls.length; i++) {
                var k = ls.key(i);
                if (k && k.indexOf(ADDON_BACKUP_PREFIX) === 0) {
                    out[k.slice(ADDON_BACKUP_PREFIX.length)] = ls.getItem(k);
                }
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    /* 用 srcdoc 打开插件设置页：srcdoc 继承父文档 origin，
       localStorage 与主页面共享，插件设置才存得住（blob: 在 file:// 下会丢）。
       location.search / hash 在 srcdoc 下为空，改用注入变量传递。 */
    function buildAddonDoc(addonId) {
        var src = getAddonSource();
        if (!src) return '';
        var locale = 'en';
        try {
            locale = document.documentElement.lang || 'en';
        } catch (e) { /* ignore */ }
        var backup = readAddonBackup();
        var head = '<scr' + 'ipt>' +
            'window.__blSearch=' + JSON.stringify('?locale=' + encodeURIComponent(locale)) + ';'
            +
            'window.__blHash=' + JSON.stringify(addonId ? '#' + addonId : '') + ';' +
            'window.__blThemeDark=' + (window.__bilupThemeIsDark ? 'true' : 'false') + ';' +
            'window.__blBackup=' + JSON.stringify(backup).replace(/</g, '\\u003c') + ';' +
            '</' + 'scr' + 'ipt>';
        var pos = src.indexOf('<div id="app">');
        if (pos > 0) return src.slice(0, pos) + head + src.slice(pos);
        return head + src;
    }

    /* 编辑器用 iframe.src 时（无窗口管理器）的回落地址：blob URL */
    function buildAddonUrl() {
        if (addonUrl) return addonUrl;
        var src = buildAddonDoc('');
        if (!src) return null;
        addonUrl = makeBlobUrl(src);
        return addonUrl;
    }

    var addonUrl = null;

    window.__bilupAddonURL = function () {
        return buildAddonUrl();
    };

    /* srcdoc 主路径 */
    window.__bilupAddonSrc = function (addonId) {
        return buildAddonDoc(addonId);
    };

    /* 切换插件：重新注入带新 hash 的源码（srcdoc 下改 src 无效） */
    window.__bilupAddonSetHash = function (iframe, addonId) {
        if (!iframe || !iframe.srcdoc) return false;
        try {
            iframe.srcdoc = buildAddonDoc(addonId);
            return true;
        } catch (e) {
            return false;
        }
    };

    /* 插件页发来的保存请求 -> 落到父窗口 localStorage（备份，供 srcdoc 下次注入） */
    var addonSaveHooked = false;
    function hookAddonSaveOnce() {
        if (addonSaveHooked) return;
        addonSaveHooked = true;
        window.addEventListener('message', function (e) {
            var d = e && e.data;
            if (!d || typeof d !== 'object') return;
            try {
                if (d.__blAddonSave && typeof d.__blAddonSave === 'object') {
                    var keys = Object.keys(d.__blAddonSave);
                    for (var i = 0; i < keys.length; i++) {
                        window.localStorage.setItem(ADDON_BACKUP_PREFIX + keys[i],
                            String(d.__blAddonSave[keys[i]]));
                    }
                } else if (typeof d.__blAddonSaveOne === 'string') {
                    window.localStorage.setItem(ADDON_BACKUP_PREFIX + d.__blAddonSaveOne,
                        String(d.__blAddonSaveVal));
                } else if (typeof d.__blAddonRemove === 'string') {
                    window.localStorage.removeItem(ADDON_BACKUP_PREFIX + d.__blAddonRemove);
                }
            } catch (err) { /* ignore */ }
        });
    }

    /* ================================================================== *
     * 菜单条窄监听（只在挂载成功后启用，避免监听整个 body 拖慢启动）
     * ================================================================== */

    function watchMenuBar() {
        if (!window.MutationObserver || watchMenuBar.done) return;
        watchMenuBar.done = true;
        var queued = false;
        var check = function () {
            queued = false;
            /* 按钮被 React 摘掉 / 整个菜单栏被换掉都要补回来 */
            var live = document.querySelector('.tw-theme-btn');
            var bar = document.querySelector('[class*="menu-bar_main-menu_"]');
            if (!live || !live.isConnected || !bar) {
                try { mount(); } catch (e) { /* ignore */ }
            }
        };
        var observer = new window.MutationObserver(function () {
            if (queued) return;
            queued = true;
            /* 用 setTimeout 而不是 rAF：后台标签 / 省电模式下 rAF 会被节流，
               按钮被摘掉后可能几秒都补不回来，正是「有时打不开主题」的另一种表现。 */
            window.setTimeout(check, 0);
        });
        try { observer.observe(document.documentElement, { childList: true, subtree: true }); }
        catch (e) { /* ignore */ }
        /* 兜底：观察者偶尔合并掉单次变更时，低频巡检也能把按钮补回来 */
        window.setInterval(function () {
            if (!document.querySelector('.tw-theme-btn')) {
                try { mount(); } catch (e) { /* ignore */ }
            }
        }, 600);
    }

    /* ================================================================== *
     * 「返回编辑界面」按钮：仅播放器模式（只有舞台 + 项目 ID 输入框）显示
     * ================================================================== */

    var playerBtn = null;
    var playerWasOn = null;

    function isPlayerOnly() {
        var store = window.ReduxStore;
        if (!store || typeof store.getState !== 'function') return false;
        try {
            var st = store.getState();
            return !!(st && st.scratchGui && st.scratchGui.mode && st.scratchGui.mode.isPlayerOnly);
        } catch (e) {
            return false;
        }
    }

    function backToEditor() {
        var store = window.ReduxStore;
        if (!store || typeof store.dispatch !== 'function') return;
        try {
            store.dispatch({ type: 'scratch-gui/mode/SET_PLAYER', isPlayerOnly: false });
        } catch (e) { /* ignore */ }
    }

    function ensurePlayerButton() {
        if (playerBtn) return playerBtn;
        playerBtn = document.createElement('button');
        playerBtn.type = 'button';
        playerBtn.className = 'bl-back-editor';
        playerBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
            '<span>返回编辑界面</span>';
        playerBtn.addEventListener('click', backToEditor);
        return playerBtn;
    }

    function placePlayerButton() {
        var btn = ensurePlayerButton();
        if (!isPlayerOnly()) {
            if (btn.parentNode) btn.parentNode.removeChild(btn);
            return;
        }
        if (btn.parentNode) return;

        /* 优先插到「项目 ID 输入框」所在的 section 之后 */
        var inputs = document.querySelectorAll('input[type="text"]');
        for (var i = 0; i < inputs.length; i++) {
            if (String(inputs[i].value || '').indexOf('https://scratch.mit.edu/projects/') !== 0) continue;
            var section = inputs[i].closest ? inputs[i].closest('div[class*="_section_"]') : null;
            if (section && section.parentNode) {
                var wrap = document.createElement('div');
                wrap.className = 'bl-back-editor-wrap';
                wrap.appendChild(btn);
                section.parentNode.insertBefore(wrap, section.nextSibling);
                return;
            }
        }

        /* 兜底：播放器容器里的主内容列 */
        var container = document.querySelector('div[class*="playerOnly"]');
        var center = container ? container.querySelector('div[class*="_center_"]') : null;
        if (!center) center = container;
        if (center) center.appendChild(btn);
    }

    function initPlayerButton() {
        var store = window.ReduxStore;
        if (!store || typeof store.getState !== 'function') return false;

        function tick() {
            var on = isPlayerOnly();
            if (on !== playerWasOn) {
                playerWasOn = on;
                placePlayerButton();
            }
        }

        tick();
        if (typeof store.subscribe === 'function') store.subscribe(tick);
        /* store.subscribe 之外的保险，防止漏掉一次状态变化 */
        window.setInterval(tick, 600);
        return true;
    }

    /* ================================================================== *
     * 启动
     * ================================================================== */

    /* ================================================================== *
     * 运行守护
     * 编译型脚本（Bilup 把 Scratch 编译成 JS 提速）出错时，线程会直接死掉，
     * 表现为作品点了绿旗没反应，同时控制台刷一片 Uncaught。
     * 这里在短时间内连续捕获到运行时错误时，自动关掉编译器退回解释器，
     * 让作品先跑起来（速度慢一些，但不会卡住）。
     * ================================================================== */

    var errStamps = [];
    var guardFired = false;

    function getVM() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return (st && st.scratchGui && st.scratchGui.vm) || null;
        } catch (e) {
            return null;
        }
    }

    function vmRunning(vm) {
        try {
            return !!(vm.runtime && vm.runtime.threads && vm.runtime.threads.length);
        } catch (e) {
            return false;
        }
    }

    function compilerOn(vm) {
        try {
            return !!(vm.runtime && vm.runtime.compilerOptions && vm.runtime.compilerOptions.enabled);
        } catch (e) {
            return false;
        }
    }

    function blNotify(text) {
        if (typeof window.__blLog === 'function') {
            try { window.__blLog(text, 'warn'); } catch (e) { /* ignore */ }
        }
        try { window.console.warn(text); } catch (e) { /* ignore */ }
    }

    function fallbackToInterpreter() {
        var vm = getVM();
        if (!vm || !vm.runtime) return false;
        try { vm.runtime.compilerOptions.enabled = false; } catch (e) { return false; }

        /* 关键：绝不能在 window error 回调里同步动线程。
           错误往往是在 runtime._step() 执行过程中抛出的，此时直接 stopAll+greenFlag
           等于在一帧还没跑完时就替换掉 runtime.threads，会让栈与栈帧失去同步，
           正是 "Cannot read properties of undefined (reading 'reuse')" 的成因。
           推到下一个宏任务执行，那时 _step 已经退出。 */
        window.setTimeout(function () {
            try { vm.stopAll(); } catch (e) { /* ignore */ }
            try { vm.start(); } catch (e) { /* ignore */ }
            try { vm.greenFlag(); } catch (e) { /* ignore */ }
        }, 0);

        blNotify('检测到脚本运行出错，已切换为兼容模式重新运行');
        return true;
    }

    function noteRuntimeError() {
        if (guardFired) return;
        var vm = getVM();
        if (!vm) return;
        if (!compilerOn(vm)) return;   /* 已经是解释器，没有可降级的余地 */
        if (!vmRunning(vm)) return;    /* 没在跑，就不是运行期错误 */
        var now = Date.now();
        /* 节流：页面本身就刷屏时不要被同一批错误瞬间打满计数 */
        if (errStamps.length && now - errStamps[errStamps.length - 1] < 60) return;
        errStamps.push(now);
        while (errStamps.length && now - errStamps[0] > 3000) errStamps.shift();
        if (errStamps.length >= 4) {
            guardFired = true;
            errStamps = [];
            fallbackToInterpreter();
        }
    }

    function installRuntimeGuard() {
        if (window.__blGuardInstalled) return;
        window.__blGuardInstalled = true;
        window.addEventListener('error', function () {
            try { noteRuntimeError(); } catch (e) { /* ignore */ }
        });
        window.addEventListener('unhandledrejection', function () {
            try { noteRuntimeError(); } catch (e) { /* ignore */ }
        });
        /* 换了作品就允许再降级一次 */
        var vm = getVM();
        if (vm && typeof vm.on === 'function') {
            try {
                vm.on('PROJECT_LOADED', function () {
                    guardFired = false;
                    errStamps = [];
                });
            } catch (e) { /* ignore */ }
        }
    }

    /* ================================================================== *
     * 菜单：在「插件」下方插入「油猴插件」
     * 菜单由 React 渲染，展开时才存在，所以要观察 DOM 再插入。
     * ================================================================== */

    var usMenuTimer = null;

    function findAddonsItem(menu) {
        var items = menu.querySelectorAll('[class*="menu_menu-item"], [class*="menu-bar_menu-bar-item"], li');
        for (var i = 0; i < items.length; i++) {
            var txt = (items[i].textContent || '').trim();
            /* 菜单项文本可能带快捷键后缀，只取首行判断 */
            if (txt.indexOf('插件') === 0 || txt === '插件' || txt.indexOf('Addons') === 0) {
                return items[i];
            }
        }
        return null;
    }

    function insertUserscriptItem(menu) {
        if (!menu || menu.querySelector('.bl-us-menu-item')) return false;
        var anchor = findAddonsItem(menu);
        if (!anchor) return false;
        var cls = anchor.className || '';
        var el = document.createElement('div');
        el.className = cls + ' bl-us-menu-item';
        el.setAttribute('role', 'menuitem');
        el.innerHTML =
            '<span class="bl-us-menu-icon" aria-hidden="true">' +
            '<svg width="14" height="14" viewBox="0 0 24 24">' +
            '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>' +
            '<path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"></path></svg></span>' +
            '<span>油猴插件</span>';
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            openUserscriptWindow();
        });
        if (anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
        return true;
    }

    function openUserscriptWindow() {
        var api = window.__blUserscript;
        if (api && typeof api.open === 'function') {
            api.open();
            return;
        }
        /* us.js 还没就绪时给个提示，避免点了没反应 */
        try { window.console.warn('油猴插件模块尚未就绪'); } catch (e) { /* ignore */ }
    }

    function watchMenuForUserscript() {
        if (!window.MutationObserver || usMenuTimer) return;
        usMenuTimer = window.setInterval(function () {
            var menus = document.querySelectorAll('[class*="menu_menu_"]');
            for (var i = 0; i < menus.length; i++) {
                try { insertUserscriptItem(menus[i]); } catch (e) { /* ignore */ }
            }
        }, 400);
    }

    /* 轮询一次：返回 true 表示全部就绪 */
    /* 逐步独立：任何一步抛错都不该连坐后面的步骤。
       之前 mount() 因为变量未声明抛错，导致 patchZoom / installSmoothScroll
       全部没执行 —— 表现为"主题按钮不出现 + 滚动缩放动画全没了"。
       单步隔离后，即使某一步失败，其余功能照常。 */
    function safeStep(name, fn) {
        try { return fn(); } catch (e) {
            if (window.console && console.warn) {
                console.warn('[StartEditor] 初始化步骤失败: ' + name, e);
            }
            return null;
        }
    }

    /* ================================================================= *
     * 毛玻璃：把我们新增的浮层接进编辑器的毛玻璃主题
     *
     * 编辑器自带的毛玻璃插件（bl-frosted-glass）只认它自己的选择器，
     * 我们后加的浮层一概不在它的名单里，于是开启毛玻璃后会出现
     * "窗口是玻璃、右键菜单和搜索框还是实色"的割裂感。
     *
     * 这里不重新实现一套毛玻璃，而是读插件自己的配置
     * （localStorage 的 bl:frosted-glass：enabled / blurRadius / opacity / themeBoost），
     * 用完全相同的取色策略（--color-scheme 决定明暗、纯黑或纯白打底）
     * 生成一张补充样式表，把我们这几类浮层补齐：
     *   · 右键菜单（React 的 context-menu_* / Blockly 的 blocklyContextMenu / goog-menu）
     *   · 搜索框
     *   · 主题面板
     *   · 新增的窗口（渐变编辑器 / 油猴 / 唱片机…）
     *
     * 配置关闭时整张表移除，不留残余。
     * 设置在同一页面内改动不会触发 storage 事件，所以用低频轮询兜底。
     * ================================================================= */

    var GLASS_STORE = 'bl:frosted-glass';
    var GLASS_STYLE_ID = 'bl-frosted-glass-bl-extra';

    /* 液态玻璃与毛玻璃是叠加关系：毛玻璃负责铺那层玻璃底与整体模糊，
       液态玻璃负责边缘折射与高光。所以这里不做互斥，毛玻璃照常生效。 */
    function glassCfg() {
        try {
            var raw = window.localStorage.getItem(GLASS_STORE);
            if (!raw) return null;
            var o = JSON.parse(raw);
            if (!o || !o.enabled) return null;
            return {
                blur: (typeof o.blurRadius === 'number' ? o.blurRadius : 12),
                opacity: (typeof o.opacity === 'number' ? o.opacity : 0.25),
                boost: (typeof o.themeBoost === 'number' ? o.themeBoost : 0.15)
            };
        } catch (e) { return null; }
    }

    /* 与插件同源：只看 --color-scheme，深色 → 纯黑，浅色 → 纯白 */
    function glassIsDark() {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue('--color-scheme');
            if (String(v).trim() === 'dark') return true;
            if (String(v).trim() === 'light') return false;
        } catch (e) { /* ignore */ }
        return editorIsDark();
    }

    /* 第 34 轮：毛玻璃同样分出层次 —— 顶部斜向高光 + 内描边 +
       两段外阴影。只加在「玻璃载体」上，子分区不重复叠模糊。 */
    var GLASS_DEPTH =
        '    background-image: linear-gradient(160deg, rgba(255,255,255,0.20), ' +
        'rgba(255,255,255,0) 46%) !important;\n' +
        '    box-shadow: inset 0 1px 0 rgba(255,255,255,0.34), ' +
        'inset 0 -1px 0 rgba(0,0,0,0.08), ' +
        '0 2px 6px rgba(0,0,0,0.06), 0 14px 34px rgba(0,0,0,0.14) !important;\n';

    function glassCss(c) {
        var dark = glassIsDark();
        var t = dark ? '0, 0, 0' : '255, 255, 255';

        /* 取值规则必须与插件逐字一致，否则"窗口是玻璃、面板是另一档透明度"：
           深色模式叠 themeBoost 后封顶 0.72，浅色模式只用 opacity。 */
        var p = dark ? Math.min(0.72, c.opacity + c.boost) : c.opacity;
        p = Math.max(0.05, Math.min(0.72, p));
        /* 插件把一档基色 p 派生成三阶，这里照抄它的比例，不再自己另定一套：
             p     面板档 —— 原生对话框主面
             0.55p 窗体档 —— 原生窗口"内容区"就是这一档（p=0.25 时实测 0.137），
                   所以自建浮层的整体底色必须取它，才和旁边的窗口是同一块玻璃
             0.40p 内层档 —— 原生窗口标题栏就是这一档（实测 0.100），
                   用于标题、页脚、内部卡片 */
        var body = +(p * 0.55).toFixed(3);
        var inner = +(p * 0.4).toFixed(3);

        var line = 'rgba(' + t + ', ' + (dark ? 0.22 : 0.14) + ')';
        /* 与插件逐字一致：blur(Npx) saturate(150%)。
           少写 saturate 会让同一块背景在窗口里偏艳、在面板里发灰 ——
           这是"同类弹窗观感对不上"最容易被忽略的一处。 */
        var blurPx = Math.max(2, Math.round(c.blur));
        var blurCss = 'blur(' + blurPx + 'px) saturate(150%)';

        var panelC = 'rgba(' + t + ', ' + p.toFixed(3) + ')';
        var bodyC = 'rgba(' + t + ', ' + body.toFixed(3) + ')';
        var innerC = 'rgba(' + t + ', ' + inner.toFixed(3) + ')';

        /* 模糊只写一次、只写在同一块"玻璃载体"上。
           子分区若也写 backdrop-filter，会和父层叠成两层模糊，
           同样的 blurRadius 在不同弹窗里浓度却不一样 —— 这正是之前
           "同类弹窗观感对不上"的来源。所以子分区只给底色，明确 blur: none。 */
        var bd = '    backdrop-filter: ' + blurCss + ' !important;\n' +
                 '    -webkit-backdrop-filter: ' + blurCss + ' !important;\n';
        var bdNone = '    backdrop-filter: none !important;\n' +
                     '    -webkit-backdrop-filter: none !important;\n';

        /* 三层结构，和原生窗口一一对应：
             surface  玻璃载体：body 档底色 + 全表唯一的一层模糊
             inner    标题 / 页脚 / 结果列表：inner 档，不再叠模糊
             soft     内部卡片、输入框、色块：更淡，不再叠模糊
           所有弹窗共用这一组取值，改一处即全局一致。 */

        return '' +
        '/* 由 inject 生成：统一所有浮层的玻璃参数（与 bl:frosted-glass 同源） */\n' +

        /* 0) 把这一组值发布成 CSS 变量，供液态玻璃、提示条等其它模块复用，
              避免它们各写一个透明度，出现"这个窗 0.25、那个窗 0.20"。 */
        ':root {\n' +
        '    --bl-glass-panel: ' + panelC + ';\n' +
        '    --bl-glass-body: ' + bodyC + ';\n' +
        '    --bl-glass-inner: ' + innerC + ';\n' +
        '    --bl-glass-line: ' + line + ';\n' +
        '    --bl-glass-blur: ' + blurCss + ';\n' +
        '}\n' +

        /* 1) 菜单 —— 三类实现一并覆盖：
              · 菜单栏下拉（menu_menu_*）：编辑器自己的样式给的是纯半透明黑、
                没有模糊，所以它和旁边的玻璃窗口"一个糊一个不糊"；
              · React 的 context-menu_*（右键菜单）；
              · Blockly 的 .blocklyContextMenu / .goog-menu（积木上右键）；
              · addon 的 .sa-*-context-menu。 */
        '[class*="menu_menu_"]:not([class*="menu_menu-item"]),\n' +
        '[class*="context-menu_menu"]:not([class*="context-menu_menu-item"]),\n' +
        '.blocklyContextMenu,\n' +
        '.goog-menu,\n' +
        '.sa-context-menu,\n' +
        '.sa-folder-context-menu {\n' +
        '    background-color: var(--bl-glass-body) !important;\n' +
        '    background-image: none !important;\n' +
        '    border: 1px solid var(--bl-glass-line) !important;\n' +
        bd +
        GLASS_DEPTH +
        '}\n' +
        /* 菜单项自身保持透明融入，避免出现一条条实色 */
        '[class*="context-menu_menu"] > div,\n' +
        '[class*="context-menu_menu"] > ul,\n' +
        '[class*="menu_menu_"] > ul,\n' +
        '.goog-menuitem {\n' +
        '    background-color: transparent !important;\n' +
        '}\n' +

        /* 2) 搜索框：外壳是玻璃载体，结果列表挂在它上面，
              所以结果区只铺淡底色、不再叠一层模糊。 */
        '.bl-search-box {\n' +
        '    background-color: var(--bl-glass-body) !important;\n' +
        '    background-image: none !important;\n' +
        '    border: 1px solid var(--bl-glass-line) !important;\n' +
        bd +
        GLASS_DEPTH +
        '}\n' +
        '.bl-search-results,\n' +
        '.bl-search-dropdown {\n' +
        '    background-color: var(--bl-glass-inner) !important;\n' +
        '    border-color: var(--bl-glass-line) !important;\n' +
        bdNone +
        '}\n' +

        /* 3) 主题面板 */
        '.tw-panel {\n' +
        '    background-color: var(--bl-glass-body) !important;\n' +
        '    background-image: none !important;\n' +
        '    border: 1px solid var(--bl-glass-line) !important;\n' +
        bd +
        GLASS_DEPTH +
        '}\n' +
        '.tw-panel-head,\n' +
        '.tw-panel-foot {\n' +
        '    background-color: var(--bl-glass-inner) !important;\n' +
        bdNone +
        '}\n' +

        /* 4) 贴靠位置面板 —— 之前是实色 --ui-primary，完全没接进玻璃主题，
              所以它和旁边的窗口"一实一虚"。 */
        '.bl-snap {\n' +
        '    background-color: var(--bl-glass-body) !important;\n' +
        '    background-image: none !important;\n' +
        '    border: 1px solid var(--bl-glass-line) !important;\n' +
        bd +
        GLASS_DEPTH +
        '}\n' +
        '.bl-snap-zone {\n' +
        '    background-color: var(--bl-glass-inner) !important;\n' +
        '    border-color: var(--bl-glass-line) !important;\n' +
        bdNone +
        '}\n' +

        /* 5) 工具停靠条 —— 只作用于 .bl-dock-inner（有背景的条）。
              .bl-dock 是纯定位容器（position:absolute + pointer-events:none），
              给它加 backdrop-filter 会生成意外渲染层，把内部图标挤偏移。 */
        '.bl-dock-inner {\n' +
        '    background: transparent !important;\n' +
        '    border: 0 !important;\n' +
        '    box-shadow: none !important;\n' +
        '    -webkit-backdrop-filter: none !important;\n' +
        '    backdrop-filter: none !important;\n' +
        '}\n' +
        '.bl-dock-inner::before {\n' +
        '    background-color: var(--bl-glass-body) !important;\n' +
        '    border-color: var(--bl-glass-line) !important;\n' +
        bd +
        GLASS_DEPTH +
        '}\n' +

        /* 6) 我们新增的窗口 —— 窗口根由插件负责（同一套取值），
              这里只补齐它没管到的内容区与内部分区。 */
        '.grad-win .addon-window-content,\n' +
        '.bl-us-window .addon-window-content {\n' +
        '    background-color: var(--bl-glass-body) !important;\n' +
        bdNone +
        '}\n' +
        '.grad-win .addon-window-header,\n' +
        '.bl-us-window .addon-window-header {\n' +
        '    background-color: var(--bl-glass-inner) !important;\n' +
        bdNone +
        '}\n' +
        /* 内部卡片：淡玻璃而非实色 */
        '.grad-col,\n' +
        '.bl-us-list,\n' +
        '.bl-us-editor,\n' +
        '.bl-us-logs {\n' +
        '    background-color: var(--bl-glass-inner) !important;\n' +
        '    border-color: var(--bl-glass-line) !important;\n' +
        bdNone +
        '}\n' +
        /* 输入框：透明融入玻璃 */
        '.grad-input,\n' +
        '.bl-us-editor textarea {\n' +
        '    background-color: var(--bl-glass-inner) !important;\n' +
        '    border-color: var(--bl-glass-line) !important;\n' +
        bdNone +
        '}\n';
    }
    function syncGlass() {
        var cfg = glassCfg();
        var el = document.getElementById(GLASS_STYLE_ID);
        if (!cfg) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            return false;
        }
        var css = glassCss(cfg);
        if (!el) {
            el = document.createElement('style');
            el.id = GLASS_STYLE_ID;
            (document.head || document.documentElement).appendChild(el);
        }
        if (el.textContent !== css) el.textContent = css;
        return true;
    }

    function installGlass() {
        syncGlass();
        /* 暴露给液态玻璃模块：它开启时需要毛玻璃立刻铺底，
           不能等 900ms 的轮询。 */
        try { window.__blGlassSync = syncGlass; } catch (e) { /* ignore */ }
        /* 即时通道：任何一处写玻璃配置（液态开关 / 参数 / 毛玻璃开关）
           都会派发 bl:glass-change。写入后同一个事件循环内就重建样式表，
           不再依赖 MutationObserver（启动 / 加载作品时总线会冻结）
           和 150ms 轮询（B01 会把它抬到 500ms 且在冻结期跳过）。 */
        try {
            window.addEventListener('bl:glass-change', function () {
                try { syncGlass(); } catch (e) { /* ignore */ }
            });
        } catch (e2) { /* ignore */ }
        /* 设置在同一页面内改动不会触发 storage 事件，低频轮询兜底。
           内容未变时只写一次 textContent，开销可忽略。 */
        window.setInterval(function () {
            try { syncGlass(); } catch (e) { /* ignore */ }
        }, 150);
        return true;
    }

    /* ================================================================= *
     * iOS 风格拖动条
     *
     * 原生 <input type="range"> 在各平台长得都不一样。这里统一成 iOS 的
     * 样子：4px 细轨道，已过的部分填色，20px 白色圆形滑块带投影。
     * 只改外观 —— input 本身保留，值、事件、React 受控都不受影响。
     *
     * 已过部分的百分比靠 CSS 变量 --p 传递（渐变做不到"按值取一段"），
     * 所以每帧之外还需要 JS 在 input 时同步一次。
     * ================================================================= */

    function rangePercent(el) {
        var min = parseFloat(el.min);
        var max = parseFloat(el.max);
        var v = parseFloat(el.value);
        if (isNaN(min)) min = 0;
        if (isNaN(max)) max = 100;
        if (isNaN(v)) v = min;
        if (!(max > min)) return 0;
        var r = (v - min) / (max - min);
        if (r < 0) r = 0; else if (r > 1) r = 1;
        return r * 100;
    }

    function syncRangeFill(el) {
        if (!el || el.type !== 'range') return;
        try { el.style.setProperty('--p', rangePercent(el).toFixed(2) + '%'); } catch (e) { /* ignore */ }
    }

    function iosifyRanges(root) {
        var list = (root || document).querySelectorAll('input[type="range"]');
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            /* Blockly 画在积木里的输入框不是 range，这里再兜一层 */
            if (el.closest && el.closest('svg')) continue;
            if (el.getAttribute('data-bl-ios-range')) continue;
            el.setAttribute('data-bl-ios-range', '1');
            syncRangeFill(el);
        }
    }

    function installIOSRanges() {
        if (installIOSRanges.done) return;
        installIOSRanges.done = true;

        iosifyRanges(document);

        document.addEventListener('input', function (e) {
            var t = e.target;
            if (t && t.type === 'range') syncRangeFill(t);
        }, true);

        /* 设置页每个分类都是 React 按需渲染的，新出现的滑杆要补上 */
        if (window.MutationObserver) {
            var mo = new MutationObserver(function () { iosifyRanges(document); });
            try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
        }
    }

    /* ================================================================= *
     * 全局底部音谱
     *
     * 唱片机弹窗里的"音谱"开关现在管的是这个：整个编辑器底部常驻一条
     * 音谱条。弹窗内那个小音谱则改成常驻显示。
     * ================================================================= */

    function installGlobalViz() {
        if (installGlobalViz.done) return;
        installGlobalViz.done = true;

        var host = blTopLayer();
        var cv = document.createElement('canvas');
        cv.className = 'bl-global-viz';
        host.appendChild(cv);
        var ctx = null;
        try { ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
        if (!ctx) return;

        var on = false;
        var raf = 0;
        var idle = 0;

        function resize() {
            var dpr = Math.min(2, window.devicePixelRatio || 1);
            var w = cv.clientWidth || window.innerWidth;
            var h = cv.clientHeight || 48;
            var bw = Math.max(1, Math.round(w * dpr));
            var bh = Math.max(1, Math.round(h * dpr));
            if (cv.width !== bw || cv.height !== bh) {
                cv.width = bw; cv.height = bh;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { w: w, h: h };
        }

        function frame() {
            raf = 0;
            if (!on) return;
            var d = resize();
            var w = d.w, h = d.h;
            ctx.clearRect(0, 0, w, h);

            var an = (window.__blVinylAnalyser && window.__blVinylAnalyser()) || null;
            var data = null;
            if (an) {
                try {
                    data = new Uint8Array(an.frequencyBinCount);
                    an.getByteFrequencyData(data);
                } catch (e) { data = null; }
            }

            var n = Math.max(24, Math.min(120, Math.floor(w / 12)));
            var gap = 2;
            var bw = (w - gap * (n - 1)) / n;
            var grad = ctx.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, 'rgba(120, 200, 210, 0.35)');
            grad.addColorStop(0.55, 'rgba(150, 130, 230, 0.6)');
            grad.addColorStop(1, 'rgba(255, 150, 190, 0.85)');
            ctx.fillStyle = grad;

            var avg = 0;
            for (var i = 0; i < n; i++) {
                var v = 0;
                if (data && data.length) {
                    /* 非线性取样：低频不会全挤在最左边 */
                    var t = i / n;
                    var idx = Math.floor(Math.pow(t, 1.7) * (data.length - 1));
                    v = data[idx] / 255;
                }
                avg += v;
                var bh2 = Math.max(2, v * (h - 10));
                var x = i * (bw + gap);
                ctx.globalAlpha = 0.85;
                ctx.fillRect(x, h - bh2 - 4, bw, bh2);
            }
            ctx.globalAlpha = 1;
            avg = n ? avg / n : 0;

            /* 底部亮线：随平均能量起伏 */
            ctx.fillStyle = 'rgba(255,255,255,' + (0.10 + avg * 0.55).toFixed(3) + ')';
            ctx.fillRect(0, h - 2, w, 2);

            /* 没在播放时不要空转太久 —— 留几十帧画完平静态就停。
               判据必须是"有没有在播"，不能只看平均能量：
               一首歌的安静段落 avg 也会接近 0，若按能量判静默，
               唱到轻声处音谱就自己死掉，看着就是"不跃动了"。 */
            if (!playingNow()) {
                idle++;
                if (idle > 60) return;
            } else {
                idle = 0;
            }
            raf = window.requestAnimationFrame(frame);
        }

        function loop() {
            idle = 0;
            if (!raf) raf = window.requestAnimationFrame(frame);
        }

        /* 播放状态由唱片机持有，全局音谱只读取它。 */
        function playingNow() {
            try {
                if (window.__blVinyl && typeof window.__blVinyl.isPlaying === 'function') {
                    return !!window.__blVinyl.isPlaying();
                }
            } catch (e) { /* ignore */ }
            return false;
        }

        /* 唤醒器：这条底部音谱原来是单向启动的 ——
           打开开关时起一次 raf，如果当时还没播放音乐，
           静默计数到 60 帧就 return，raf 归零后再也没有东西把它拉起来。
           之后你再点播放，音谱始终是死的（画一条不动的底线）。
           现在只要开关开着就每 400ms 探一次：在播且循环已停就重启。
           播放中 raf 恒不为 0，这个定时器什么也不做，开销可以忽略。 */
        window.setInterval(function () {
            if (!on || raf) return;
            if (playingNow()) loop();
        }, 400);

        function stop() {
            if (raf) window.cancelAnimationFrame(raf);
            raf = 0;
            try { ctx.clearRect(0, 0, cv.width, cv.height); } catch (e) { /* ignore */ }
        }

        window.__blGlobalViz = {
            set: function (v) {
                on = !!v;
                cv.classList.toggle('is-on', on);
                if (on) loop(); else stop();
            },
            get: function () { return on; }
        };

        window.addEventListener('resize', function () { if (on) loop(); });
    }

    /* ================================================================= *
     * 统一弹窗置顶
     *
     * 之前有兩套互不相通的层级体系：
     *   - 原版窗口：编辑器自己的 bringToFront()，基数 8000，逐个 ++
     *   - 新增窗口：顶层宿主 #bl-top-layer，固定 999998
     * 结果就是"原版弹窗永远在新增弹窗下面"（或者反过来写死一个极高值，
     * 变成新增弹窗永远在下面）。
     *
     * 这里改成一套：谁被点到 / 操作，谁就到最前面。
     *   - 点新增窗口 → 它在宿主内排最高，同时把所有越到宿主之上的原版窗口降回原生区间
     *   - 点原版窗口 → 把它抬到 OVER_HOST_Z（高于宿主 999998），原版之间保持原生区间
     * ================================================================= */

    var HOST_Z = 999998;
    var OVER_HOST_Z = 999999;

    /* 加载界面还在时不要碰任何窗口的层级。
       编辑器自带的加载界面 z-index 是 2147483647（比所有弹窗都高），
       而"询问扩展权限"这类原生弹窗是靠自己的极高值显示在它之上的。
       一旦被我们的置顶逻辑重排回 8001 起，就会被加载界面整块盖住 ——
       表现就是"拖动了一下窗口，窗口就不见了"。 */
    function loadingActive() {
        var el = document.getElementById('blLoading');
        if (!el || !el.parentNode) return false;
        try {
            var cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            if (parseFloat(cs.opacity) < 0.05) return false;
        } catch (e) { /* ignore */ }
        return true;
    }

    /* 除了我们自己的加载界面，还可能有一层"整屏且极高"的遮罩
       （比如加载作品时那层）。它同样会盖住关键弹窗，
       所以这里也认：body 直接子元素里，全屏 + z-index 极高的可见层。 */
    function splashBlocker() {
        try {
            var kids = document.body.children;
            var vw = window.innerWidth || 0, vh = window.innerHeight || 0;
            for (var i = 0; i < kids.length; i++) {
                var el = kids[i];
                if (!el || el.id === 'blLoading') continue;
                var cs = window.getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                if (parseFloat(cs.opacity) < 0.05) continue;
                var z = parseInt(cs.zIndex, 10);
                if (isNaN(z) || z < 1000000) continue;
                var r = el.getBoundingClientRect();
                if (r.width < vw * 0.9 || r.height < vh * 0.9) continue;
                return el;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    /* ================================================================== *
     * 关键弹窗：扩展权限询问那一类
     *
     * 它们是模态的、必须由用户当场决定，一旦被盖住就等于"窗口不见了" ——
     * 用户看到的现象正是"鼠标一移过去就没了"，其实是被压在了下面。
     *
     * 这里让它们始终待在关键层：
     *   · 不参与 unifyFront 的重排（不许被降级）
     *   · 主动抬到 CRIT_Z
     *   · 若整屏加载层比它还高，让加载层降一级给它让路
     * ================================================================== */

    var CRIT_Z = '2147483646';
    var CRIT_SEL = '[class*="security-manager-modal"], [id*="securitymanager"],' +
                   '[class*="security-manager_modal"]';

    function critModals() {
        var out = [];
        try {
            var list = document.querySelectorAll(CRIT_SEL);
            for (var i = 0; i < list.length; i++) {
                var el = list[i];
                if (!el || !el.getBoundingClientRect) continue;
                var r = el.getBoundingClientRect();
                if (r.width < 120 || r.height < 80) continue;
                out.push(el);
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    function isCriticalModal(el) {
        if (!el || !el.matches) return false;
        try { return el.matches(CRIT_SEL); } catch (e) { return false; }
    }

    /* 不属于我们这套体系的窗口：用了极高 z-index 的原生弹窗
       （权限询问、确认框、加载提示等）。它们靠自己的值压在加载界面之上，
       参与我们的重排只会被拉下来，所以一律不碰。 */
    function isForeignZ(z) {
        return !isNaN(z) && z > 100000;
    }

    function hostOfEl(el) {
        if (!el || !el.closest) return null;
        try { return el.closest('#bl-top-layer'); } catch (e) { return null; }
    }

    /* 一个"置顶单元"：
       - 宿主内就是那个窗口本身
       - 原版若是 ReactModal 结构，整块遮罩一起抬（内容在它里面）
       - 否则就是窗口元素自己 */
    var UNIT_SEL = '.addon-window, [class*="modal-window"], [class*="modal-content"],' +
                   '[class*="ReactModal__Overlay"], [class*="modal-overlay"]';

    function frontUnitOf(el) {
        if (!el || !el.closest) return null;
        if (hostOfEl(el)) {
            return el.closest('.addon-window') || el.closest('#bl-top-layer > *');
        }
        /* ⚠ 必须取"最外层"那个窗口元素。
           设置窗口是两层结构：.addon-window（父）里套 .modal-window-content（子）。
           父的 z-index 才决定整个窗口的位置 —— 把子抬到 999999 没用，
           父在 8002，子再高也仍被父所在的层压着。
           所以命中子之后要一路向上找到最外层的匹配单元。 */
        var u = el.closest(UNIT_SEL);
        if (!u) return null;
        var p = u.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
            if (p.matches && p.matches(UNIT_SEL)) u = p;
            p = p.parentElement;
        }
        return u;
    }

    /* 只收"最外层"的原版窗口：
       内部那层 .modal-window-content 不参与排序，否则会被当成独立单元抬起来，
       结果父窗口还留在下面，等于没动。 */
    function allNativeUnits() {
        var out = [];
        var all = document.querySelectorAll(UNIT_SEL);
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (hostOfEl(el)) continue;
            var p = el.parentElement, outer = false;
            while (p && p !== document.body && p !== document.documentElement) {
                if (p.matches && p.matches(UNIT_SEL)) { outer = true; break; }
                p = p.parentElement;
            }
            if (!outer) out.push(el);
        }
        return out;
    }

    function unifyFront(el) {
        if (loadingActive()) return;
        var u = frontUnitOf(el);
        if (!u) return;
        /* 关键弹窗（扩展权限询问）不参与重排：
           它们靠极高值压在加载界面之上，一旦被重排就会被整块盖住 */
        if (isCriticalModal(u)) { ensureCriticalTop(); return; }
        /* 外来高值弹窗不参与：它们靠自己的值压在加载界面之上 */
        if (isForeignZ(parseInt(u.style.zIndex, 10))) return;
        var inHost = !!hostOfEl(u);

        /* 先把所有"越到宿主之上"的原版单元降回原生区间，
           否则点新增窗口时它们仍会压在上面 */
        var ns = allNativeUnits();
        for (var i = 0; i < ns.length; i++) {
            if (ns[i] === u) continue;
            var z = parseInt(ns[i].style.zIndex, 10);
            if (isNaN(z) || z <= HOST_Z) continue;
            /* 高于 OVER_HOST_Z 的是原生关键弹窗（确认框等），不能降级 */
            if (z > OVER_HOST_Z) continue;
            ns[i].style.zIndex = String(WIN_Z_BASE + 1 + i);
            /* 内部那层也一起压回去，避免残留一个高值把整块又顶上来 */
            var inner = ns[i].querySelector('[class*="modal-window"], [class*="modal-content"]');
            if (inner && inner !== ns[i]) {
                var iz = parseInt(inner.style.zIndex, 10);
                if (!isNaN(iz) && iz > HOST_Z) inner.style.zIndex = String(WIN_Z_BASE + 1 + i);
            }
        }

        if (inHost) {
            /* 宿主内排序 —— 与油猴窗口同一套规则 */
            bringTopLayerFront(u);
        } else {
            u.style.zIndex = String(OVER_HOST_Z);
        }
    }

    var critRaf = 0;

    function ensureCriticalTop() {
        var list = critModals();
        if (!list.length) return;
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            if (el.style.zIndex !== CRIT_Z) el.style.zIndex = CRIT_Z;
            /* 玻璃效果不许碰：这类弹窗是不透明的，
               被半透明化之后深色文字压在深色背景上，看上去就像消失了 */
            if (!el.hasAttribute('data-bl-lg-skip')) {
                try { el.setAttribute('data-bl-lg-skip', '1'); } catch (e) { /* ignore */ }
            }
        }
        /* 整屏加载层比关键弹窗还高时会把它整块盖住 —— 给它让一级 */
        try {
            var ld = document.getElementById('blLoading');
            if (ld && loadingActive()) {
                var z = parseInt(ld.style.zIndex, 10);
                if (isNaN(z) || z >= 2147483646) ld.style.zIndex = '2147483645';
            }
            var sp = splashBlocker();
            if (sp) {
                var z2 = parseInt(sp.style.zIndex, 10);
                if (isNaN(z2) || z2 >= 2147483646) sp.style.zIndex = '2147483645';
            }
        } catch (e) { /* ignore */ }
    }

    function installCriticalTop() {
        if (installCriticalTop.done) return;
        installCriticalTop.done = true;

        var tick = function () {
            try { ensureCriticalTop(); } catch (e) { /* ignore */ }
        };
        var schedule = function () {
            if (critRaf) return;
            critRaf = window.requestAnimationFrame(function () { critRaf = 0; tick(); });
        };
        if (window.MutationObserver) {
            var mo = new MutationObserver(schedule);
            try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
        }
        window.setInterval(tick, 400);
        tick();
    }

    function installUnifiedFront() {
        if (installUnifiedFront.done) return;
        installUnifiedFront.done = true;

        var pending = null;
        function apply() {
            if (!pending) return;
            var u = pending; pending = null;
            unifyFront(u);
        }

        /* 捕获阶段最先跑，比编辑器的置顶逻辑早 */
        function hit(e) {
            var t = e.target;
            if (!t || !t.closest) return null;
            return frontUnitOf(t) || null;
        }

        ['pointerdown', 'mousedown', 'focusin'].forEach(function (type) {
            document.addEventListener(type, function (e) {
                var u = hit(e);
                if (!u) return;
                pending = u;
                unifyFront(u);
                /* 编辑器自己的 bringToFront 会在之后跑并可能覆盖，
                   所以下一帧再压一次，保证"点谁谁在最前"最终成立 */
                window.requestAnimationFrame(apply);
            }, true);
        });

        /* 新出现的原版弹窗也要置顶（否则会开在宿主下面看不见） */
        if (window.MutationObserver) {
            var mo = new MutationObserver(function (muts) {
                for (var i = 0; i < muts.length; i++) {
                    var added = muts[i].addedNodes;
                    for (var j = 0; j < added.length; j++) {
                        var n = added[j];
                        if (!n || n.nodeType !== 1) continue;
                        var u = frontUnitOf(n);
                        /* 新增窗口（不论原版还是我们自己的）一出现就置顶，
                           否则会开在别的窗口下面 —— 尤其原版弹窗会开在宿主之下看不见 */
                        if (u) unifyFront(u);
                    }
                }
            });
            try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
        }

        /* 包一层而不是替换内部逻辑：任何窗口被抬到 OVER_HOST_Z / CRIT_Z 之后，
       都把 DOCK 宿主重新放回 body 末尾。这样 DOCK 与关键弹窗同值时
       也永远在它们之上 —— 用户要的「始终比弹窗高」由此闭环。 */
    try {
        window.__blUnifyFront = function (el) {
            try { unifyFront(el); } finally {
                try { window.__blDockTop && window.__blDockTop(); } catch (e3) { /* ignore */ }
            }
        };
    } catch (e4) { /* ignore */ }
        /* 工具箱窗口带 .addon-window，frontUnitOf / allNativeUnits 天然收录：
           点原版弹窗时它会被降回原生区间，点它时会被抬到 OVER_HOST_Z，
           两者共用同一套「谁活动谁在最前」的排序（第 32 轮）。 */
        try { window.__blLayerInfo = { host: HOST_Z, over: OVER_HOST_Z,
                                       base: WIN_Z_BASE, max: WIN_Z_MAX }; }
        catch (e2) { /* ignore */ }
        /* 供 us.js / vinyl.js 把窗口收进 DOCK（DOCK 本体在 sea.js） */
        try {
            window.__blDockMin = {
                min: dockMinimize,
                restore: dockRestore,
                forget: dockForget,
                has: dockTrayHas
            };
        } catch (e) { /* ignore */ }
    }

    function tickOnce() {
        var ok = !!safeStep('mount', mount);
        var SB = window.ScratchBlocks;
        if (SB) {
            safeStep('hookContextMenu', function () { return hookContextMenu(); });
            safeStep('patchZoom', function () { return patchZoom(SB); });
        }
        safeStep('installSmoothScroll', installSmoothScroll);
        safeStep('patchThemeColors', patchThemeColors);
        safeStep('patchToolboxCreate', patchToolboxCreate);
        safeStep('watchEditorTheme', watchEditorTheme);
        safeStep('watchStageSize', watchStageSize);
        safeStep('hookAddonSaveOnce', hookAddonSaveOnce);
        safeStep('watchMenuForUserscript', watchMenuForUserscript);
        safeStep('hookHomeLogo', hookHomeLogo);
        safeStep('installHomeGuard', installHomeGuard);
        safeStep('applyAppearance', applyAppearance);
        safeStep('watchAppearance', watchAppearance);
        safeStep('installGlass', installGlass);
        safeStep('installIOSRanges', installIOSRanges);
        safeStep('installGlobalViz', installGlobalViz);
        safeStep('installUnifiedFront', installUnifiedFront);
        safeStep('installCriticalTop', installCriticalTop);
        safeStep('installVersionItem', installVersionItem);
        return !!(ok && SB);
    }

    function boot() {
        initLoading();
        try { watchNativeWindows(); } catch (e) { /* ignore */ }

        /* 预设色板与自定义主题必须先注册，否则存档里的自定义主题 id 会被判为无效 */
        try { initPresets(); } catch (e) { /* ignore */ }
        try { loadCustomThemes(); } catch (e) { /* ignore */ }

        var saved = readStore(STORE_THEME);
        if (!saved || !THEMES[saved]) saved = 'light';
        currentTheme = saved;

        /* 与编辑器当前主题对齐：明暗不一致说明用户是在编辑器里改的，
           此时交出界面配色控制权，只负责让积木区跟上 */
        var editorDark = editorIsDark();
        var mineDark = !!(THEMES[saved] && THEMES[saved].dark);
        if (editorDark !== mineDark) {
            myGuiActive = false;
            saved = editorDark ? 'dark' : 'light';
            currentTheme = saved;
            writeStore(STORE_THEME, saved);
        } else if (saved !== 'light' && saved !== 'dark') {
            /* 存档里是我们自己的主题（预设 / 自定义渐变）：夺回界面配色控制权。
               之前这里不置位，导致 applyGuiOnly 直接跳过写变量 ——
               重启后自定义渐变主题完全不生效，界面还是编辑器默认配色。 */
            myGuiActive = true;
        }

        patchThemeColors();
        applyTheme(saved, false);
        markActive(saved);
        syncPackagerTheme();

        installRuntimeGuard();
        installBackdropAsset();
        installPackagerHandshake();
        scheduleWarmPackager();
        mount();
        hookContextMenu();

        /* 下面是"锦上添花"的功能，跟编辑器能不能起来无关。
           全部推到首屏画完之后再做，把启动阶段的主线程让给编辑器本体。 */
        deferStartup(function () {
            initWindows();
            watchWindowZ();
            initNativeDockMin();
            initReadability();
            initPlayerButton();
        });

        var ticks = 0;
        var timer = window.setInterval(function () {
            ticks++;
            /* 注入逻辑的任何异常都不该冒泡成 Uncaught 刷满控制台 */
            try {
                if (tickOnce()) {
                    window.clearInterval(timer);
                    watchMenuBar();
                    return;
                }
            } catch (e) { /* ignore */ }
            if (ticks > 120) window.clearInterval(timer);
        }, 300);

        window.addEventListener('mw:theme-applied', function () {
            resetVarCache();
            applyGuiOnly();
            try { syncBlocks(false); } catch (e) { /* ignore */ }
        });

    }

    /* 把非关键初始化推到首屏之后：优先用 requestIdleCallback，
       没有就在两帧后执行。这样启动阶段主线程尽量留给编辑器本体。 */
    var deferred = [];
    var deferFlushed = false;

    function deferStartup(fn) {
        if (deferFlushed) {
            try { fn(); } catch (e) { /* ignore */ }
            return;
        }
        deferred.push(fn);
    }

    function flushDeferred() {
        if (deferFlushed) return;
        deferFlushed = true;
        var run = function () {
            for (var i = 0; i < deferred.length; i++) {
                try { deferred[i](); } catch (e) { /* ignore */ }
            }
            deferred = [];
        };
        if (typeof window.requestIdleCallback === 'function') {
            try {
                window.requestIdleCallback(run, { timeout: 3000 });
                return;
            } catch (e) { /* 退到下面 */ }
        }
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                window.setTimeout(run, 0);
            });
        });
    }

    /* 加载界面必须最先初始化，且不能被后续任何一步的异常拖住。
       即使 boot 里剩下的逻辑抛错，加载界面也已经进入自己的退出流程。 */
    function start() {
        try {
            initLoading();
        } catch (e) {
            /* 兜底都失败了就直接摘掉加载界面，绝不能把用户挡在外面 */
            var el = document.getElementById('blLoading');
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }
        try {
            boot();
        } catch (e2) {
            /* 主逻辑失败不影响编辑器自身运行，加载界面照常退出 */
        }
    }

    if (document.body) {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }
})();

