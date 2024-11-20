import express, { Request, Response } from 'express';
import mysql from 'mysql';
import cookieParser from 'cookie-parser'; 
import path from 'path';

const app = express();
const PORT = 3007;

const db = mysql.createConnection({
  socketPath: '/cloudsql/my-project-1524331659983:us-central1:aitutor',
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


app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
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


app.get('/login', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'login.html'));
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


app.post('/api/register-course', (req: Request, res: Response) => {
  const courseId = req.body.courseId;
  const userId = req.cookies.userId;

  if (!userId) {
    res.status(401).json({ message: 'User not logged in' });
    return;
  }

  const updateUserQuery = 'UPDATE User SET CourseId = ? WHERE UserId = ?';
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


app.get('/tutor', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'tutor.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
