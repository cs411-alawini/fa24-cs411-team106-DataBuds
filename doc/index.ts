import 'dotenv/config';
import express, { Request, Response } from 'express';
import mysql from 'mysql';
import cookieParser from 'cookie-parser'; 
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = 3007;

const db = mysql.createConnection({
  socketPath: './cloudsql/my-project-1524331659983:us-central1:aitutor',
  user: 'root',
  password: '123',
  database: 'aitutor'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL database.');
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');




app.get('/login', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});


app.get('/signup', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});


app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body; // read 
  const query = 'SELECT UserId FROM User WHERE username = ? AND password = ?';
  
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      res.status(500).json({ error: 'Database error' });
    } else if (results.length > 0) {
      const userId = results[0].UserId;
      res.cookie('userId', userId);
      res.redirect('/courses');
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  });
});


app.post('/api/signup', (req: Request, res: Response) => {
  const { username, password } = req.body;


  const checkQuery = 'SELECT * FROM User WHERE username = ?';
  db.query(checkQuery, [username], (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }

    if (results.length > 0) {
      res.status(400).json({ message: 'Username already taken' });
    } else {
      
      const insertQuery = 'INSERT INTO User (username, password) VALUES (?, ?)'; // create
      db.query(insertQuery, [username, password], (err) => {
        if (err) {
          console.error('Error inserting into the database:', err);
          res.status(500).json({ error: 'Database error' });
        } else {
          res.redirect('/login');
        }
      });
    }
  });
});

app.post('/api/delete-user', (req: Request, res: Response) => {
  const { username, password } = req.body;

  const checkQuery = 'SELECT UserId FROM User WHERE username = ? AND password = ?';
  
  db.query(checkQuery, [username, password], (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }

    if (results.length > 0) {
      const deleteQuery = 'DELETE FROM User WHERE username = ? AND password = ?'; // delete
      
      db.query(deleteQuery, [username, password], (err) => {
        if (err) {
          console.error('Error deleting user from database:', err);
          res.status(500).json({ error: 'Database error' });
        } else {
          
          res.clearCookie('userId');
          res.redirect('/login');
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  });
});

app.get('/api/search-courses', (req: Request, res: Response) => { // keyword search
  const { keyword } = req.query;

  if (!keyword) {
    return ;
  }

  
  const query = 'SELECT * FROM Courses WHERE Topic LIKE ?';
  const searchKeyword = `%${keyword}%`;

  db.query(query, [searchKeyword], (err, results) => {
    if (err) {
      console.error('Error searching for courses:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json({ courses: results });
    }
  });
});

app.get('/courses', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'courses.html'));
});


app.get('/api/courses', (req: Request, res: Response) => {
  const query = 'SELECT * FROM Courses';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching courses:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json({ courses: results });
    }
  });
});


app.get('/api/avg-difficulty', (req: Request, res: Response) => {
  const query = 'CALL GetAvgDifficulty();'; // call  stored procedure

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing stored procedure:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      const avgDifficultyData = results[0]; 
      res.json({ avgDifficulty: avgDifficultyData });
    }
  });
});

app.post('/api/register-course', (req: Request, res: Response) => {
  const courseId = req.body.courseId;
  const userId = req.cookies.userId;

  if (!userId) {
    res.status(401).json({ message: 'User not logged in' });
    return;
  }

  const updateUserQuery = 'UPDATE User SET CourseId = ? WHERE UserId = ?'; // update
  const getTopicQuery = 'SELECT Topic FROM Courses WHERE CourseId = ?';

  db.query(updateUserQuery, [courseId, userId], (err) => {
    if (err) {
      console.error('Error registering course:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      db.query(getTopicQuery, [courseId], (err, results) => {
        if (err || results.length === 0) {
          console.error('Error fetching course topic:', err);
          res.status(500).json({ error: 'Could not fetch course topic' });
        } else {
          const topic = results[0].Topic;
          res.redirect(`/tutor?topic=${encodeURIComponent(topic)}`);
        }
      });
    }
  });
});

app.get('/api/course-enrollment-stats', (req: Request, res: Response) => {
  const query = 'CALL CourseEnrollmentStatistics();'; // call stored procedure

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing stored procedure:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      
      const courseStats = results[0]; 
      res.json({ courseStats });
    }
  });
});


app.get('/tutor', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'tutor.html'));
});


app.post('/api/chat/question', (req: Request, res: Response) => {
  const { topic } = req.body;
  
  const query = `
    SELECT Question, Answer 
    FROM Problems 
    WHERE Topic = ? 
    ORDER BY RAND() 
    LIMIT 1
  `;

  db.query(query, [topic], (err, results) => {
    if (err) {
      console.error('Error querying Problems table:', err);
      res.status(500).json({ error: 'Database error' });
    } else if (results.length > 0) {
      
      res.cookie('currentAnswer', results[0].Answer);
      res.json({ 
        question: results[0].Question,
        context: `You are learning about ${topic}. Please answer the following question:`
      });
    } else {
      res.status(404).json({ error: 'No questions found for this topic' });
    }
  });
});


app.post('/api/chat', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const { userAnswer } = req.body;
      const correctAnswer = req.cookies.currentAnswer;

      if (!correctAnswer) {
        return res.status(400).json({ error: 'No active question found' });
      }

      const feedback = await generateFeedback(userAnswer, correctAnswer);
      res.json({ feedback, correctAnswer });
    } catch (error) {
      next(error);
    }
  })();
});

app.post('/api/chat', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const { userAnswer } = req.body;
      const correctAnswer = req.cookies.currentAnswer;
      const userId = req.cookies.userId;
      const courseId = req.cookies.courseId;  

      if (!correctAnswer) {
        return ;
      }

      const feedback = await generateFeedback(userAnswer, correctAnswer);

     
      const userMessageQuery = 'INSERT INTO ChatHistory (UserId, CourseId, Sender, Message) VALUES (?, ?, ?, ?)';
      db.query(userMessageQuery, [userId, courseId, 'user', userAnswer], (err) => {
        if (err) {
          console.error('Error storing user message:', err);
        }
      });

     
      const tutorMessageQuery = 'INSERT INTO ChatHistory (UserId, CourseId, Sender, Message) VALUES (?, ?, ?, ?)';
      db.query(tutorMessageQuery, [userId, courseId, 'tutor', feedback], (err) => {
        if (err) {
          console.error('Error storing tutor message:', err);
        }
      });

      res.json({ feedback, correctAnswer });
    } catch (error) {
      next(error);
    }
  })();
});


async function generateFeedback(userAnswer: string, correctAnswer: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `
    Compare the following student answer to the correct answer and provide constructive feedback:
    
    Student's Answer: "${userAnswer}"
    Correct Answer: "${correctAnswer}"
    
    Provide feedback that:
    1. Acknowledges what the student did well
    2. Points out any misconceptions or errors
    3. Explains the correct approach if needed
    Keep the tone encouraging and constructive.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

