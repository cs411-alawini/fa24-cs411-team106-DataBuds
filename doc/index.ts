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
    SELECT Question, Answer, Difficulty 
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
      res.cookie('currentTopic', topic, { 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      res.cookie('currentAnswer', results[0].Answer, { 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      res.cookie('currentQuestion', results[0].Question, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
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
      const topic = req.cookies.currentTopic;
      const userId = req.cookies.userId;

      if (!correctAnswer || !topic) {
        console.error('Missing data in cookies:', req.cookies);
        return res.status(400).json({ error: 'No active question or topic found' });
      }

      // Get feedback and resources in parallel
      const [feedback, resources] = await Promise.all([
        generateAdaptiveFeedback(userAnswer, correctAnswer, userId, topic),
        new Promise((resolve, reject) => {
          const query = `
            SELECT WebURL, ResourceType, RecommendationCount 
            FROM Info 
            WHERE Topic = ?
            ORDER BY RAND()
            LIMIT 3
          `;
          
          db.query(query, [topic], (err, results) => {
            if (err) {
              reject(err);
            } else {
              resolve(results);
            }
          });
        })
      ]);
      
      if (userId) {
        const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
        try {
          await updateUserProgress(userId, topic, isCorrect, req.cookies.currentQuestion || '');
        } catch (err) {
          console.error('Error updating progress:', err);
        }
      }

      res.json({ 
        feedback,
        correctAnswer,
        resources,  // Include resources in response
        success: true
      });
    } catch (error) {
      console.error('Chat error:', error);
      next(error);
    }
  })();
});

async function updateUserProgress(
  userId: number, 
  topic: string, 
  isCorrect: boolean, 
  currentQuestion: string
): Promise<void> {
  if (!topic) {
    throw new Error('Topic is required for updating progress');
  }

  // First check if a record exists
  const checkQuery = `
    SELECT UserId, Topic 
    FROM UserProgress 
    WHERE UserId = ? AND Topic = ?
  `;

  const insertOrUpdateQuery = `
    INSERT INTO UserProgress (UserId, Topic, LastQuestion, CorrectAnswers, TotalAttempts) 
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE 
    LastQuestion = ?,
    CorrectAnswers = CorrectAnswers + ?,
    TotalAttempts = TotalAttempts + 1
  `;
  
  return new Promise((resolve, reject) => {
    db.query(insertOrUpdateQuery, [
      userId, 
      topic, 
      currentQuestion, 
      isCorrect ? 1 : 0,  // initial CorrectAnswers
      currentQuestion,     // LastQuestion for update
      isCorrect ? 1 : 0   // increment to CorrectAnswers
    ], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function generateAdaptiveFeedback(
  userAnswer: string, 
  correctAnswer: string, 
  userId: number, 
  topic: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      Compare the student answer "${userAnswer}" to the correct answer "${correctAnswer}" 
      for the topic ${topic}. Provide constructive feedback.
    `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    // Provide a fallback response when the API is unavailable
    return `I'm currently having trouble providing detailed feedback.
      Your answer: "${userAnswer}"
      Correct answer: "${correctAnswer}"
      Please compare these and try another question.`;
  }
}

app.get('/api/resources/:topic', (req: Request, res: Response) => {
  const topic = req.params.topic;
  const query = `
    SELECT WebURL, ResourceType, RecommendationCount 
    FROM Info 
    WHERE Topic = ?
    ORDER BY RAND()
    LIMIT 3`;
  
  db.query(query, [topic], (err, results) => {
    if (err) {
      console.error('Error fetching resources:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json({ resources: results });
    }
  });
});

app.post('/api/assign-tutor', (req: Request, res: Response) => {
  const userId = req.cookies.userId;
  
  db.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'Transaction error' });
    }

    const query = `
      UPDATE Tutor
      SET CurrentUserId = ?
      WHERE TutorId = (
        SELECT TutorId FROM (
          SELECT T.TutorId
          FROM Tutor T
          JOIN Courses C ON T.Topic = C.Topic
          JOIN User U ON U.CourseId = C.CourseId
          WHERE U.UserId = ? 
          AND T.CurrentUserId IS NULL
          LIMIT 1
        ) AS SubQuery
      )
    `;

    db.query(query, [userId, userId], (err, result) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error assigning tutor:', err);
          res.status(500).json({ error: 'Assignment error' });
        });
      }

      if (result.affectedRows === 0) {
        return db.rollback(() => {
          res.status(400).json({ error: 'No available tutor found for your course' });
        });
      }

      db.commit((err) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error committing transaction:', err);
            res.status(500).json({ error: 'Commit error' });
          });
        }
        res.json({ message: 'Tutor assigned successfully' });
      });
    });
  });
});

app.get('/api/tutor-problems/:userId', (req: Request, res: Response) => {
  const userId = req.params.userId;
  
  db.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'Transaction error' });
    }

    const query = `
      SELECT T.TutorId, T.Topic, COUNT(P.ProblemId) AS TotalProblems
      FROM Tutor T
      JOIN Courses C ON T.Topic = C.Topic
      JOIN Problems P ON P.Topic = C.Topic
      JOIN User U ON U.CourseId = C.CourseId
      WHERE U.UserId = ?
      GROUP BY T.TutorId, T.Topic
      FOR UPDATE
    `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error in query:', err);
          res.status(500).json({ error: 'Query error' });
        });
      }

      db.commit((err) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error committing transaction:', err);
            res.status(500).json({ error: 'Commit error' });
          });
        }
        res.json({ tutorProblems: results });
      });
    });
  });
});

app.post('/api/release-tutor', (req: Request, res: Response) => {
  const userId = req.cookies.userId;

  const query = `
    UPDATE Tutor 
    SET CurrentUserId = NULL
    WHERE CurrentUserId = ?
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error('Error releasing tutor:', err);
      res.status(500).json({ error: 'Release error' });
    } else {
      res.json({ message: 'Tutor released successfully' });
    }
  });
});

app.post('/api/lock-tutor-by-topic', (req: Request, res: Response) => {
  const { topic, userId } = req.body;
  
  db.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'Transaction error' });
    }

    // Check and lock the tutor for this topic
    const query = `
      SELECT T.TutorId, T.Topic, T.IsAvailable
      FROM Tutor T
      WHERE T.Topic = ? AND T.IsAvailable = 1
      FOR UPDATE
    `;

    db.query(query, [topic], (err, results) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error checking tutor:', err);
          res.status(500).json({ error: 'Query error' });
        });
      }

      if (results.length === 0) {
        return db.rollback(() => {
          res.status(400).json({ error: 'Tutor for this topic is not available' });
        });
      }

      const tutor = results[0];
      
      // Lock the tutor
      const updateQuery = `
        UPDATE Tutor 
        SET IsAvailable = 0, CurrentUserId = ?
        WHERE Topic = ?
      `;

      db.query(updateQuery, [userId, topic], (err) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error locking tutor:', err);
            res.status(500).json({ error: 'Update error' });
          });
        }

        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              console.error('Error committing transaction:', err);
              res.status(500).json({ error: 'Commit error' });
            });
          }
          res.json({ 
            message: 'Tutor locked successfully',
            tutor
          });
        });
      });
    });
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

