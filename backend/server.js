import fastify  from "fastify";
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client";
import sensible from "@fastify/sensible"
import cookies from "@fastify/cookie"
import cors from "@fastify/cors"


 dotenv.config();
 const app = fastify();
 app.register(sensible);
 app.register(cookies,{secret : "my-secret"})
 
 app.register(cors,{
    origin : process.env.CLIENT_URL ,
    credentials : true ,
 });

 app.addHook("onRequest",(req,res,done) =>{
   if (req.cookies.userId !==CURRENT_USER_ID){
      req.cookies.userId = CURRENT_USER_ID
      res.clearCookie("userId")
      res.setCookie("userId",CURRENT_USER_ID)
   }
   done()
 } )


const prisma = new PrismaClient();
const CURRENT_USER_ID = (await prisma.user.findFirst({
   where : {
      name : "Sally"
   }
})).id

 app.get("/posts" ,async     (req, res)=>{
        return await comitTodb(prisma.post.findMany({select: {
            id : true,
            title:true
        }}))
 });

 const CommentSelectField = {
   id : true,
   message : true,
   parentId : true,
   createdAt : true,
   user : {
      select : {
         id : true,
         name: true
      }
   } 
}
app.get("/posts/:id", async (req, res) => {
   return await comitTodb(
     prisma.post
       .findUnique({
         where: { id: req.params.id },
         select: {
           body: true,
           title: true,
           comments: {
             orderBy: {
               createdAt: "desc",
             },
             select: {
               ...CommentSelectField,
               _count: { select: { likes: true } },
             },
           },
         },
       })
       .then(async post => {
         const likes = await prisma.like.findMany({
           where: {
             userId: req.cookies.userId,
             commentId: { in: post.comments.map(comment => comment.id) },
           },
         })
 
         return {
           ...post,
           comments: post.comments.map(comment => {
             const { _count, ...commentFields } = comment
             return {
               ...commentFields,
               likedByMe: likes.find(like => like.commentId === comment.id),
               likeCount: _count.likes,
             }
           }),
         }
       })
   )
 })
 

 app.post("/posts/:id/comments", async (req, res) => {
   if (req.body.message === "" || req.body.message == null) {
     return res.send(app.httpErrors.badRequest("Message is required"))
   }
 
   return await comitTodb(
     prisma.comment
       .create({
         data: {
           message: req.body.message,
           userId: req.cookies.userId,
           parentId: req.body.parentId,
           postId: req.params.id,
         },
         select: CommentSelectField,
       })
       .then(comment => {
         return {
           ...comment,
           likeCount: 0,
           likedByMe: false,
         }
       })
   )
 })


app.put('/posts/:idPost/comments/:idComment',async (req,res)=>{

   if(req.body.message ==="" || req.body.message ==null ){
      return res.send(app.httpErrors.badRequest("Message is Required"))
   }
   const {userId}  = await  prisma.comment.findFirst({
      where : {id : req.params.idComment},
      select : {
         userId : true  
      }})
      if (userId !==req.cookies.userId) return res.send(
         app.httpErrors.unauthorized("You dont have permession")
      )

   return await comitTodb( 
      prisma.comment.update({
         
         data : {
            message : req.body.message,
         },
         where : {
            id : req.params.idComment
         },
         select : {
            message : true
         } 

      })
   )
})

app.delete('/posts/:idPost/comments/:idComment',async (req,res)=>{

   const {userId}  = await  prisma.comment.findFirst({
      where : {id : req.params.idComment},
      select : {
         userId : true  
      }})
      if (userId !==req.cookies.userId) return res.send(
         app.httpErrors.unauthorized("You dont have permession For Deleting")
      )

   return await comitTodb( 
      prisma.comment.delete({
         
         where : {
            id : req.params.idComment
         },
         select : {id:true}
      })
   )
})


app.post('/posts/:idPost/comments/:idComment/toggleLike', async ( req,res)=>{

   const data = {
      commentId : req.params.idComment, 
      userId : req.cookies.userId
   }
   const like = await prisma.like.findUnique({where : {userId_commentId : data}});
   if (like == null) {
      return await comitTodb(prisma.like.create({data})).then(()=>{
         return {addLike : true}
      })
   }
   else {
         return await comitTodb(prisma.like.delete({where : {userId_commentId:data}})).then(()=>{
         return {addLike : false} 
      })    
   }
})



 async function comitTodb(promise) {
    const [error,data] = await  app.to(promise)

    if(error) return app.httpErrors.internalServerError
    return data

 }
 app.listen({port:process.env.PORT})